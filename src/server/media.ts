import 'server-only'
import { z } from 'zod'
import type { Prisma } from '@/generated/prisma/client'
import { db } from '@/lib/db'
import { AppError } from '@/lib/http'
import * as storage from './storage'

// The media library: photos, audio (songs, voice notes) and video belonging to one surprise.
// Flow: start() reserves a row and returns an upload target → the browser uploads directly →
// complete() sniffs the stored bytes and only then marks the media ready.

export const KINDS = ['image', 'audio', 'video'] as const
export type MediaKind = (typeof KINDS)[number]

const MB = 1024 * 1024
export const LIMITS: Record<MediaKind, { bytes: number; perSurprise: number; label: string }> = {
  image: { bytes: 10 * MB, perSurprise: 40, label: 'Photos' },
  audio: { bytes: 20 * MB, perSurprise: 10, label: 'Audio' },
  video: { bytes: 80 * MB, perSurprise: 5, label: 'Videos' },
}

export const StartInput = z.object({
  surpriseId: z.string().max(40),
  kind: z.enum(KINDS),
  mime: z.string().max(100),
  size: z.number().int().positive(),
  name: z.string().max(200).default(''),
})

/** The real type, from the file's first bytes. The browser's declared type is never trusted. */
export function sniff(b: Uint8Array, kind: MediaKind): string | null {
  const ascii = (from: number, to: number) => String.fromCharCode(...b.slice(from, to))
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg'
  if (b[0] === 0x89 && ascii(1, 4) === 'PNG') return 'image/png'
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'image/webp'
  if (ascii(0, 3) === 'GIF') return 'image/gif'
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WAVE') return 'audio/wav'
  if (ascii(0, 4) === 'OggS') return 'audio/ogg'
  if (ascii(0, 3) === 'ID3' || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0)) return 'audio/mpeg'
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return kind === 'audio' ? 'audio/webm' : 'video/webm'
  if (ascii(4, 8) === 'ftyp') {
    const brand = ascii(8, 12)
    if (kind === 'audio') return 'audio/mp4'
    return brand === 'qt  ' ? 'video/quicktime' : 'video/mp4'
  }
  return null
}

const ownedSurprise = async (surpriseId: string, ownerId: string) => {
  if (!(await db.surprise.findFirst({ where: { id: surpriseId, ownerId }, select: { id: true } }))) throw new AppError(404, 'Surprise not found.')
}

export async function start(ownerId: string, input: z.input<typeof StartInput>) {
  const i = StartInput.parse(input)
  const limit = LIMITS[i.kind]
  if (i.size > limit.bytes) throw new AppError(413, `${limit.label} must be under ${limit.bytes / MB} MB.`)
  if (!i.mime.startsWith(`${i.kind}/`)) throw new AppError(415, `That doesn't look like ${i.kind === 'image' ? 'a photo' : `a${i.kind === 'audio' ? 'n audio file' : ' video'}`}.`)
  await ownedSurprise(i.surpriseId, ownerId)
  if ((await db.upload.count({ where: { surpriseId: i.surpriseId, kind: i.kind } })) >= limit.perSurprise)
    throw new AppError(400, `A surprise can hold up to ${limit.perSurprise} ${limit.label.toLowerCase()}.`)
  const mime = i.mime.split(';')[0].trim().toLowerCase()
  const up = await db.upload.create({ data: { ownerId, surpriseId: i.surpriseId, kind: i.kind, status: 'pending', name: i.name, mime, size: i.size } })
  const storageKey = `media/${up.id}`
  await db.upload.update({ where: { id: up.id }, data: { storageKey } })
  return { id: up.id, ...storage.uploadTarget(storageKey, up.id, mime, i.size) }
}

const pending = async (id: string, ownerId: string) => {
  const up = await db.upload.findFirst({ where: { id, ownerId, status: 'pending' } })
  if (!up?.storageKey) throw new AppError(404, 'Upload not found.')
  return up as typeof up & { storageKey: string }
}

/** Local driver only: receives the browser's PUT. */
export async function receiveLocal(id: string, ownerId: string, body: ReadableStream<Uint8Array> | null) {
  if (storage.storageDriver !== 'local') throw new AppError(404, 'Not found.')
  const up = await pending(id, ownerId)
  if (!body) throw new AppError(400, 'No file received.')
  await storage.writeLocal(up.storageKey, body, up.size)
}

export async function complete(id: string, ownerId: string) {
  const up = await pending(id, ownerId)
  const obj = await storage.head(up.storageKey)
  const mime = obj && sniff(obj.first, up.kind as MediaKind)
  const fail = async (msg: string) => {
    await deleteMedia({ id: up.id })
    throw new AppError(415, msg)
  }
  if (!obj) throw new AppError(409, 'The file has not finished uploading.')
  if (obj.size > LIMITS[up.kind as MediaKind].bytes) await fail('That file is too large.')
  if (!mime || !mime.startsWith(`${up.kind}/`)) await fail(up.kind === 'image' ? 'Only JPEG, PNG, WebP or GIF photos are allowed.' : `That file isn't a supported ${up.kind} format.`)
  await db.upload.update({ where: { id: up.id }, data: { status: 'ready', mime: mime!, size: obj.size } })
  return { id: up.id, kind: up.kind, mime }
}

export const list = (ownerId: string, surpriseId: string, kind?: MediaKind) =>
  db.upload.findMany({
    where: { ownerId, surpriseId, status: 'ready', ...(kind && { kind }) },
    select: { id: true, kind: true, name: true, mime: true, size: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  })

/** Deletes rows and their stored objects. An object shared by a duplicated surprise stays until its last row goes. */
export async function deleteMedia(where: Prisma.UploadWhereInput) {
  const rows = await db.upload.findMany({ where, select: { id: true, storageKey: true } })
  if (!rows.length) return
  await db.upload.deleteMany({ where: { id: { in: rows.map((r) => r.id) } } })
  for (const key of new Set(rows.map((r) => r.storageKey).filter((k): k is string => Boolean(k)))) {
    if (await db.upload.count({ where: { storageKey: key } })) continue
    await storage.remove(key).catch(() => {}) // ponytail: an orphaned object costs pennies; no retry queue
  }
}

/** Uploads started but never completed (closed tab, failed network) are cleared after a day. */
export const sweepPending = () => deleteMedia({ status: 'pending', createdAt: { lt: new Date(Date.now() - 86_400_000) } })

export async function respond(up: { storageKey: string | null; data: Uint8Array | null; mime: string }, range: string | null) {
  if (up.storageKey) return storage.serve(up.storageKey, up.mime, range)
  if (!up.data) throw new AppError(404, 'Not found.')
  return new Response(up.data as BodyInit, { headers: { 'Content-Type': up.mime, 'Cache-Control': 'private, max-age=3600', 'X-Content-Type-Options': 'nosniff', 'X-Robots-Tag': 'noindex' } })
}
