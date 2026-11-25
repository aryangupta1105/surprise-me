import 'server-only'
import { db } from '@/lib/db'
import { decrypt, encrypt, randomToken, sha256 } from '@/lib/crypto'
import { env } from '@/lib/env'
import { AppError } from '@/lib/http'
import { StoredContent, StudioInput, Theme } from '@/lib/schemas'
import type { Prisma } from '@/generated/prisma/client'

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
  return db.surprise.update({
    where: { id },
    data: { content, title: content.title, ...(theme ? { theme } : {}) },
  })
}

const linkFor = (token: string) => `${env.APP_URL}/s/${token}`

/** Publishes (or re-issues) the private link. Re-issuing revokes the previous link. */
export async function publish(id: string, ownerId: string, opts: { expiresAt?: Date; rotate?: boolean } = {}) {
  const s = await ownedSurprise(id, ownerId)
  if (!s.content) throw new AppError(400, 'Generate and review the surprise before publishing.')
  StoredContent.parse(s.content)
  if (s.linkTokenEnc && !s.linkRevokedAt && !opts.rotate) {
    await db.surprise.update({
      where: { id },
      data: { status: 'PUBLISHED', linkExpiresAt: opts.expiresAt ?? s.linkExpiresAt },
    })
    return { url: linkFor(decrypt(s.linkTokenEnc)) }
  }
  const token = randomToken(24) // 192 bits
  await db.surprise.update({
    where: { id },
    data: {
      status: 'PUBLISHED',
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

export async function duplicate(id: string, ownerId: string) {
  const s = await ownedSurprise(id, ownerId)
  return db.surprise.create({
    data: {
      ownerId,
      occasion: s.occasion,
      recipientName: s.recipientName,
      creatorName: s.creatorName,
      experienceType: s.experienceType,
      title: s.title ? `${s.title} (copy)` : null,
      input: s.input as Prisma.InputJsonValue,
      content: (s.content ?? undefined) as Prisma.InputJsonValue | undefined,
      theme: (s.theme ?? undefined) as Prisma.InputJsonValue | undefined,
      generationStatus: s.content ? 'SUCCEEDED' : 'IDLE',
    },
  })
}

export async function remove(id: string, ownerId: string) {
  await ownedSurprise(id, ownerId)
  await db.surprise.delete({ where: { id } }) // cascades to generations, deliveries and photos
}

/** Scheduled "open when" letters: until unlockAt, the recipient receives the envelope but not the letter. */
export function withLockedLettersHidden(content: StoredContent, now = Date.now()): StoredContent {
  if (content.type !== 'open_when') return content
  return {
    ...content,
    letters: content.letters.map((l) => (l.unlockAt && new Date(l.unlockAt).getTime() > now ? { ...l, letter: '' } : l)),
  }
}

/** Recipient side: resolves a private link. Returns only what the recipient may see. */
export async function openByToken(token: string) {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null
  const s = await db.surprise.findUnique({ where: { linkTokenHash: sha256(token) } })
  if (!s || s.status !== 'PUBLISHED' || s.linkRevokedAt || !s.content) return null
  if (s.linkExpiresAt && s.linkExpiresAt < new Date()) return null
  const parsed = StoredContent.safeParse(s.content)
  if (!parsed.success) return null
  return {
    id: s.id,
    content: withLockedLettersHidden(parsed.data),
    theme: Theme.parse(s.theme ?? { palette: parsed.data.palette }),
    recipientName: s.recipientName,
    creatorName: s.creatorName,
  }
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
