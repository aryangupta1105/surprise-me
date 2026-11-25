import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { db } from '@/lib/db'
import { presignUrl } from '@/server/sigv4'
import { makeSurprise, makeUser } from './fixtures'

process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), 'sm-media-'))
const media = await import('@/server/media')
const { duplicate, remove, saveDraftDoc, draftDoc } = await import('@/server/surprises')

const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...new Array(40).fill(0)])
const MP3 = Uint8Array.from([0x49, 0x44, 0x33, 3, 0, ...new Array(40).fill(0)])
const stream = (b: Uint8Array) => new Blob([b as BlobPart]).stream()

async function uploaded(ownerId: string, surpriseId: string, kind: 'image' | 'audio', bytes: Uint8Array, mime: string) {
  const t = await media.start(ownerId, { surpriseId, kind, mime, size: bytes.length })
  await media.receiveLocal(t.id, ownerId, stream(bytes))
  return { t, done: await media.complete(t.id, ownerId) }
}

describe('sigv4', () => {
  it('matches the AWS documented presigned-URL example', () => {
    const url = presignUrl({
      method: 'GET', host: 'examplebucket.s3.amazonaws.com', path: '/test.txt', region: 'us-east-1',
      accessKeyId: 'AKIAIOSFODNN7EXAMPLE', secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY', expires: 86400, now: new Date('2013-05-24T00:00:00Z'),
    })
    expect(url).toContain('X-Amz-Signature=aeeed9bbccd4d02ee5c0109b86d86835f995330da4c265957d157751f604d404')
  })
})

describe('sniff', () => {
  const ftyp = (brand: string) => Uint8Array.from([0, 0, 0, 0x18, ...Buffer.from(`ftyp${brand}`)])
  it('tells containers apart by the requested kind', () => {
    expect(media.sniff(PNG, 'image')).toBe('image/png')
    expect(media.sniff(MP3, 'audio')).toBe('audio/mpeg')
    expect(media.sniff(ftyp('M4A '), 'audio')).toBe('audio/mp4')
    expect(media.sniff(ftyp('qt  '), 'video')).toBe('video/quicktime')
    expect(media.sniff(ftyp('isom'), 'video')).toBe('video/mp4')
    expect(media.sniff(Uint8Array.from([0x1a, 0x45, 0xdf, 0xa3]), 'audio')).toBe('audio/webm')
    expect(media.sniff(Buffer.from('<html>'), 'image')).toBeNull()
  })
})

describe('media library (local storage)', () => {
  it('uploads, verifies, lists and serves with ranges', async () => {
    const u = await makeUser()
    const s = await makeSurprise(u.id)
    const { t, done } = await uploaded(u.id, s.id, 'image', PNG, 'image/png')
    expect(t.url).toBe(`/api/uploads/${t.id}/blob`)
    expect(done.mime).toBe('image/png')
    expect((await media.list(u.id, s.id, 'image')).map((m) => m.id)).toEqual([t.id])
    const row = await db.upload.findUniqueOrThrow({ where: { id: t.id } })
    const part = await media.respond(row, 'bytes=0-3')
    expect(part.status).toBe(206)
    expect(part.headers.get('content-range')).toBe(`bytes 0-3/${PNG.length}`)
    expect(new Uint8Array(await part.arrayBuffer())).toEqual(PNG.slice(0, 4))
  })

  it('rejects a file whose bytes do not match its kind, and removes it', async () => {
    const u = await makeUser()
    const s = await makeSurprise(u.id)
    const t = await media.start(u.id, { surpriseId: s.id, kind: 'image', mime: 'image/png', size: MP3.length })
    await media.receiveLocal(t.id, u.id, stream(MP3))
    await expect(media.complete(t.id, u.id)).rejects.toThrow(/Only JPEG, PNG/)
    expect(await db.upload.findUnique({ where: { id: t.id } })).toBeNull()
  })

  it('refuses more bytes than were declared, other people’s surprises, and wrong kinds', async () => {
    const u = await makeUser()
    const s = await makeSurprise(u.id)
    const t = await media.start(u.id, { surpriseId: s.id, kind: 'audio', mime: 'audio/mpeg', size: 4 })
    await expect(media.receiveLocal(t.id, u.id, stream(MP3))).rejects.toThrow(/larger/)
    const other = await makeUser()
    await expect(media.start(other.id, { surpriseId: s.id, kind: 'audio', mime: 'audio/mpeg', size: 4 })).rejects.toThrow(/not found/i)
    await expect(media.start(u.id, { surpriseId: s.id, kind: 'video', mime: 'audio/mpeg', size: 4 })).rejects.toThrow(/video/)
    await expect(media.start(u.id, { surpriseId: s.id, kind: 'video', mime: 'video/mp4', size: 200 * 1024 * 1024 })).rejects.toThrow(/under 80 MB/)
  })

  it('duplicates share stored files and remap ids; the file goes only with its last row', async () => {
    const u = await makeUser()
    const s = await makeSurprise(u.id)
    const { t } = await uploaded(u.id, s.id, 'audio', MP3, 'audio/mpeg')
    await saveDraftDoc(s.id, u.id, { version: 1, theme: { palette: 'candy', motion: 'full' }, scenes: [{ id: 'a', kind: 'media', title: 'x', blocks: [{ id: 'b', type: 'audio', props: { audioId: t.id } }] }] }, 'manual')
    const copy = await duplicate(s.id, u.id)
    const copied = await db.upload.findFirstOrThrow({ where: { surpriseId: copy.id } })
    expect(copied.id).not.toBe(t.id)
    expect(copied.storageKey).toBe(`media/${t.id}`)
    const doc = await draftDoc((await db.surprise.findUniqueOrThrow({ where: { id: copy.id } })))
    expect(doc.scenes[0].blocks[0].props.audioId).toBe(copied.id)

    await remove(s.id, u.id)
    expect((await media.respond(copied, null)).status).toBe(200) // still there for the copy
    await remove(copy.id, u.id)
    await expect(media.respond(copied, null)).rejects.toThrow(/Not found/)
  })

  it('sweeps uploads that never completed', async () => {
    const u = await makeUser()
    const s = await makeSurprise(u.id)
    const t = await media.start(u.id, { surpriseId: s.id, kind: 'image', mime: 'image/png', size: 10 })
    await db.upload.update({ where: { id: t.id }, data: { createdAt: new Date(Date.now() - 2 * 86_400_000) } })
    await media.sweepPending()
    expect(await db.upload.findUnique({ where: { id: t.id } })).toBeNull()
  })
})
