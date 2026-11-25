import 'server-only'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { cookies } from 'next/headers'
import { db } from '@/lib/db'
import { decrypt, encrypt, randomToken, sha256 } from '@/lib/crypto'
import { env } from '@/lib/env'
import { AppError } from '@/lib/http'
import { StoredContent, StudioInput, Theme } from '@/lib/schemas'
import { legacyToDoc } from '@/engine/convert'
import { parseDoc, type SurpriseDoc } from '@/engine/doc'
import type { Prisma } from '@/generated/prisma/client'
import { deleteMedia } from './media'

/** Every creator-side read/write goes through this: ownership is checked on the server, never by URL. */
export async function ownedSurprise(id: string, ownerId: string) {
  const s = await db.surprise.findFirst({ where: { id, ownerId } })
  if (!s) throw new AppError(404, 'Surprise not found.')
  return s
}

export async function createDraft(ownerId: string, input: StudioInput) {
  return db.surprise.create({
    data: {
      ownerId,
      occasion: input.occasion,
      recipientName: input.recipientName,
      creatorName: input.creatorName,
      experienceType: input.experienceType,
      input,
    },
  })
}

export async function updateInput(id: string, ownerId: string, input: StudioInput) {
  await ownedSurprise(id, ownerId)
  return db.surprise.update({
    where: { id },
    data: {
      input,
      occasion: input.occasion,
      recipientName: input.recipientName,
      creatorName: input.creatorName,
      experienceType: input.experienceType,
    },
  })
}

export async function saveContent(id: string, ownerId: string, content: StoredContent, theme?: Theme) {
  const s = await ownedSurprise(id, ownerId)
  if (s.content && (s.content as { type?: string }).type !== content.type)
    throw new AppError(400, 'Experience type cannot change while editing; regenerate instead.')
  // Published before versions existed: freeze what recipients see now, before this edit changes it.
  if (s.status === 'PUBLISHED' && !s.publishedVersionId && s.content) {
    const v = await db.surpriseVersion.create({ data: { surpriseId: id, doc: (await draftDoc(s)) as Prisma.InputJsonValue, source: 'legacy' } })
    await db.surprise.update({ where: { id }, data: { publishedVersionId: v.id } })
  }
  return db.surprise.update({
    where: { id },
    data: { content, title: content.title, ...(theme ? { theme } : {}) },
  })
}

const linkFor = (token: string) => `${env.APP_URL}/s/${token}`

/** The scene document being edited: the draft version when there is one, else derived from legacy content. */
export async function draftDoc(s: { content: unknown; theme: unknown; draftVersionId?: string | null }): Promise<SurpriseDoc> {
  if (s.draftVersionId) {
    const v = await db.surpriseVersion.findUnique({ where: { id: s.draftVersionId } })
    if (v) return parseDoc(v.doc)
  }
  return legacyDraftDoc(s)
}

const KEEP_DRAFT_VERSIONS = 30

/** Saves a new draft version (validated) and prunes old unpublished ones. */
export async function saveDraftDoc(surpriseId: string, ownerId: string, doc: unknown, source: 'ai' | 'manual' | 'template' | 'autosave') {
  const s = await ownedSurprise(surpriseId, ownerId)
  const v = await db.surpriseVersion.create({ data: { surpriseId, doc: parseDoc(doc) as Prisma.InputJsonValue, source } })
  await db.surprise.update({ where: { id: surpriseId }, data: { draftVersionId: v.id } })
  const old = await db.surpriseVersion.findMany({
    where: { surpriseId, id: { notIn: [v.id, s.publishedVersionId ?? ''] }, source: { not: 'publish' } },
    orderBy: { createdAt: 'desc' }, skip: KEEP_DRAFT_VERSIONS - 1, select: { id: true },
  })
  if (old.length) await db.surpriseVersion.deleteMany({ where: { id: { in: old.map((o) => o.id) } } })
  return v
}

export async function listVersions(id: string, ownerId: string) {
  await ownedSurprise(id, ownerId)
  const rows = await db.surpriseVersion.findMany({ where: { surpriseId: id }, orderBy: { createdAt: 'desc' }, take: 60 })
  return rows.map((v) => ({ id: v.id, source: v.source, createdAt: v.createdAt.toISOString(), scenes: ((v.doc as { scenes?: unknown[] }).scenes ?? []).length }))
}

export async function versionDoc(id: string, ownerId: string, versionId: string) {
  await ownedSurprise(id, ownerId)
  const v = await db.surpriseVersion.findFirst({ where: { id: versionId, surpriseId: id } })
  if (!v) throw new AppError(404, 'Version not found.')
  return parseDoc(v.doc)
}

/** Legacy single-experience surprise → scene document as its first draft version (published link unaffected). */
export async function convertToScenes(id: string, ownerId: string) {
  const s = await ownedSurprise(id, ownerId)
  if (s.draftVersionId) return
  // Published before versions existed: freeze what recipients see now, as saveContent does.
  if (s.status === 'PUBLISHED' && !s.publishedVersionId) {
    const v = await db.surpriseVersion.create({ data: { surpriseId: id, doc: (await draftDoc(s)) as Prisma.InputJsonValue, source: 'legacy' } })
    await db.surprise.update({ where: { id }, data: { publishedVersionId: v.id } })
  }
  await saveDraftDoc(id, ownerId, await draftDoc(s), 'manual')
}

function legacyDraftDoc(s: { content: unknown; theme: unknown }): SurpriseDoc {
  if (!s.content) throw new AppError(400, 'Generate and review the surprise before publishing.')
  const content = StoredContent.parse(s.content)
  return legacyToDoc(content, Theme.partial().parse(s.theme ?? {}))
}

/**
 * Publishes the current draft as a frozen version (recipients never see half-finished edits) and makes sure there is
 * a private link. Publishing again updates what recipients see and keeps the link; `rotate` issues a new link.
 */
export async function publish(id: string, ownerId: string, opts: { expiresAt?: Date; rotate?: boolean } = {}) {
  const s = await ownedSurprise(id, ownerId)
  const version = await db.surpriseVersion.create({ data: { surpriseId: id, doc: (await draftDoc(s)) as Prisma.InputJsonValue, source: 'publish' } })
  if (s.linkTokenEnc && !s.linkRevokedAt && !opts.rotate) {
    await db.surprise.update({
      where: { id },
      data: { status: 'PUBLISHED', publishedVersionId: version.id, linkExpiresAt: opts.expiresAt ?? s.linkExpiresAt },
    })
    return { url: linkFor(decrypt(s.linkTokenEnc)) }
  }
  const token = randomToken(24) // 192 bits
  await db.surprise.update({
    where: { id },
    data: {
      status: 'PUBLISHED',
      publishedVersionId: version.id,
      publishedAt: s.publishedAt ?? new Date(),
      archivedAt: null,
      linkTokenHash: sha256(token),
      linkTokenEnc: encrypt(token),
      linkRevokedAt: null,
      linkExpiresAt: opts.expiresAt ?? null,
    },
  })
  return { url: linkFor(token) }
}

export async function revokeLink(id: string, ownerId: string) {
  await ownedSurprise(id, ownerId)
  await db.surprise.update({ where: { id }, data: { linkRevokedAt: new Date() } })
}

export function shareUrl(s: { linkTokenEnc: string | null; linkRevokedAt: Date | null }) {
  return s.linkTokenEnc && !s.linkRevokedAt ? linkFor(decrypt(s.linkTokenEnc)) : null
}

export async function archive(id: string, ownerId: string, archived: boolean) {
  const s = await ownedSurprise(id, ownerId)
  return db.surprise.update({
    where: { id },
    data: archived
      ? { status: 'ARCHIVED', archivedAt: new Date() }
      : { status: s.publishedAt ? 'PUBLISHED' : 'DRAFT', archivedAt: null },
  })
}

/** A copy with its own media rows (stored objects are shared, not re-uploaded) and the current draft document. */
export async function duplicate(id: string, ownerId: string) {
  const s = await ownedSurprise(id, ownerId)
  const copy = await db.surprise.create({
    data: {
      ownerId,
      occasion: s.occasion,
      recipientName: s.recipientName,
      creatorName: s.creatorName,
      experienceType: s.experienceType,
      title: s.title ? `${s.title} (copy)` : null,
      input: s.input as Prisma.InputJsonValue,
      theme: (s.theme ?? undefined) as Prisma.InputJsonValue | undefined,
      generationStatus: s.content ? 'SUCCEEDED' : 'IDLE',
    },
  })
  // Media ids are random cuids, so swapping them in the serialised JSON cannot hit anything else.
  const ids = new Map<string, string>()
  for (const m of await db.upload.findMany({ where: { surpriseId: id, status: 'ready' } })) {
    const { id: oldId, createdAt: _, ...rest } = m
    ids.set(oldId, (await db.upload.create({ data: { ...rest, data: rest.data ?? undefined, surpriseId: copy.id } })).id)
  }
  const remap = (v: unknown) => v && JSON.parse(JSON.stringify(v).replace(/"([a-z0-9]{20,40})"/g, (q, k) => (ids.has(k) ? `"${ids.get(k)}"` : q)))
  const content = remap(s.content) as Prisma.InputJsonValue | undefined
  if (content) await db.surprise.update({ where: { id: copy.id }, data: { content } })
  if (s.draftVersionId) await saveDraftDoc(copy.id, ownerId, remap(await draftDoc(s)), 'manual')
  return copy
}

export async function remove(id: string, ownerId: string) {
  await ownedSurprise(id, ownerId)
  await deleteMedia({ surpriseId: id }) // stored objects first; the rest cascades
  await db.surprise.delete({ where: { id } })
}

/**
 * Time-locked content never leaves the server early: a locked scene is sent without its blocks, and a locked
 * open-when letter is sent as an envelope without its text.
 */
export function withLockedContentHidden(doc: SurpriseDoc, now = Date.now()): SurpriseDoc {
  const locked = (at?: string) => Boolean(at && new Date(at).getTime() > now)
  return {
    ...doc,
    scenes: doc.scenes.map((scene) =>
      locked(scene.unlockAt)
        ? { ...scene, blocks: [], background: undefined, music: undefined }
        : {
            ...scene,
            blocks: scene.blocks.map((b) =>
              b.type === 'open_when'
                ? { ...b, props: { ...b.props, letters: (b.props.letters as { unlockAt?: string; letter: string }[]).map((l) => (locked(l.unlockAt) ? { ...l, letter: '' } : l)) } }
                : b,
            ),
          },
    ),
  }
}

/** The published document; surprises published before versions existed are converted on the fly. */
async function publishedDoc(s: { publishedVersionId: string | null; content: unknown; theme: unknown }) {
  if (s.publishedVersionId) {
    const v = await db.surpriseVersion.findUnique({ where: { id: s.publishedVersionId } })
    return v ? parseDoc(v.doc) : null
  }
  return legacyDraftDoc(s)
}

/** A live private link's surprise (published, not revoked or expired), ignoring any link password. */
export async function liveLink(token: string) {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null
  const s = await db.surprise.findUnique({ where: { linkTokenHash: sha256(token) } })
  if (!s || s.status !== 'PUBLISHED' || s.linkRevokedAt) return null
  if (s.linkExpiresAt && s.linkExpiresAt < new Date()) return null
  return s
}

// Link passwords: a correct password sets an httpOnly cookie bound to this link and this password,
// so changing the password locks every browser out again.
export const unlockCookie = (token: string) => `sm_unlock_${sha256(token).slice(0, 16)}`
export const unlockValue = (token: string, passwordHash: string) => createHmac('sha256', env.APP_SECRET).update(`${token}|${passwordHash}`).digest('base64url')
async function isUnlocked(token: string, passwordHash: string) {
  const got = (await cookies()).get(unlockCookie(token))?.value ?? ''
  const want = unlockValue(token, passwordHash)
  return got.length === want.length && timingSafeEqual(Buffer.from(got), Buffer.from(want))
}

/** Recipient side: resolves a private link. Returns only what the recipient may see (null if gone or still password-locked). */
export async function openByToken(token: string) {
  const s = await liveLink(token)
  if (!s) return null
  if (s.linkPasswordHash && !(await isUnlocked(token, s.linkPasswordHash))) return null
  const doc = await publishedDoc(s).catch(() => null)
  if (!doc) return null
  return { id: s.id, doc: withLockedContentHidden(doc), recipientName: s.recipientName, creatorName: s.creatorName }
}

/** Privacy-light engagement: counts and progress only, no recipient identity, IP or device. */
export async function recordEngagement(token: string, event: { type: 'open' } | { type: 'progress'; percent: number }) {
  const s = await openByToken(token)
  if (!s) throw new AppError(404, 'This surprise is no longer available.')
  if (event.type === 'open') {
    await db.surprise.update({ where: { id: s.id }, data: { openCount: { increment: 1 }, lastOpenedAt: new Date() } })
    return
  }
  const percent = Math.max(0, Math.min(100, Math.round(event.percent)))
  // Only ever move forward, so replays don't lower progress.
  await db.surprise.updateMany({ where: { id: s.id, progress: { lt: percent } }, data: { progress: percent } })
  if (percent === 100) await db.surprise.updateMany({ where: { id: s.id, completedAt: null }, data: { completedAt: new Date() } })
}
