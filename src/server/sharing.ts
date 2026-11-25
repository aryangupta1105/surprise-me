import 'server-only'
import { createHmac } from 'node:crypto'
import { cookies } from 'next/headers'
import { z } from 'zod'
import { db } from '@/lib/db'
import { sha256 } from '@/lib/crypto'
import { env } from '@/lib/env'
import { AppError } from '@/lib/http'
import { parseDoc, uid } from '@/engine/doc'
import { hashPassword, verifyPassword } from './accounts'
import { draftDoc, liveLink, openByToken, ownedSurprise, saveDraftDoc, unlockCookie, unlockValue } from './surprises'

// ---------- Link password ----------

export async function setLinkPassword(id: string, ownerId: string, password: string | null) {
  await ownedSurprise(id, ownerId)
  const pw = password === null ? null : z.string().min(4, 'Use at least 4 characters.').max(100).parse(password)
  await db.surprise.update({ where: { id }, data: { linkPasswordHash: pw ? await hashPassword(pw) : null } })
}

/** Recipient enters the password once; an httpOnly cookie keeps this browser unlocked for 30 days. */
export async function unlockLink(token: string, password: string) {
  const s = await liveLink(token)
  if (!s?.linkPasswordHash) throw new AppError(404, 'This surprise isn’t available.')
  if (!(await verifyPassword(password, s.linkPasswordHash))) throw new AppError(401, 'That’s not the password — ask the person who sent it.', 'bad_password')
  ;(await cookies()).set(unlockCookie(token), unlockValue(token, s.linkPasswordHash), {
    httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 30 * 86400,
  })
}

/** For the recipient page: why a link shows nothing. */
export async function linkState(token: string): Promise<'open' | 'locked' | 'gone'> {
  if (await openByToken(token)) return 'open'
  const s = await liveLink(token)
  return s?.linkPasswordHash ? 'locked' : 'gone'
}

// ---------- Reactions ----------

export const REACTION_EMOJI = ['❤️', '😭', '😂', '🥹', '🎉', '🤗', '😍', '🔥'] as const
export const ReactionInput = z.object({
  emoji: z.enum(REACTION_EMOJI),
  message: z.string().trim().max(500).default(''),
  fromName: z.string().trim().max(60).default(''),
})

export async function addReaction(token: string, input: z.input<typeof ReactionInput>) {
  const s = await openByToken(token)
  if (!s) throw new AppError(404, 'This surprise isn’t available.')
  const r = ReactionInput.parse(input)
  if ((await db.reaction.count({ where: { surpriseId: s.id } })) >= 200) throw new AppError(429, 'This surprise has received a lot of love already!')
  await db.reaction.create({ data: { surpriseId: s.id, ...r } })
}

export async function reactionsFor(id: string, ownerId: string) {
  await ownedSurprise(id, ownerId)
  return db.reaction.findMany({ where: { surpriseId: id }, orderBy: { createdAt: 'desc' }, take: 100, select: { id: true, emoji: true, message: true, fromName: true, createdAt: true } })
}

// ---------- Group messages (friends contribute a note) ----------
// The invite token is derived from the server secret and the surprise id, so it can be shown again without
// storing it; only its hash is stored, and clearing the hash turns the link off.

const inviteToken = (surpriseId: string) => createHmac('sha256', env.APP_SECRET).update(`invite:${surpriseId}`).digest('base64url').slice(0, 32)
export const inviteUrl = (surpriseId: string) => `${env.APP_URL}/c/${inviteToken(surpriseId)}`

export async function setInvite(id: string, ownerId: string, on: boolean) {
  await ownedSurprise(id, ownerId)
  await db.surprise.update({ where: { id }, data: { inviteTokenHash: on ? sha256(inviteToken(id)) : null } })
  return on ? inviteUrl(id) : null
}

export async function inviteTarget(token: string) {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null
  const s = await db.surprise.findUnique({ where: { inviteTokenHash: sha256(token) }, select: { id: true, recipientName: true, creatorName: true, archivedAt: true } })
  return s && !s.archivedAt ? s : null
}

export const ContributionInput = z.object({
  name: z.string().trim().min(1, 'Add your name so they know who it’s from.').max(60),
  message: z.string().trim().min(2, 'Write a few words.').max(500),
})

export async function contribute(token: string, input: z.input<typeof ContributionInput>) {
  const s = await inviteTarget(token)
  if (!s) throw new AppError(404, 'This invitation has ended.')
  const c = ContributionInput.parse(input)
  if ((await db.contribution.count({ where: { surpriseId: s.id } })) >= 100) throw new AppError(429, 'This surprise already has lots of messages.')
  await db.contribution.create({ data: { surpriseId: s.id, ...c } })
}

export async function contributionsFor(id: string, ownerId: string) {
  const s = await ownedSurprise(id, ownerId)
  const list = await db.contribution.findMany({ where: { surpriseId: id }, orderBy: { createdAt: 'asc' }, select: { id: true, name: true, message: true, status: true, createdAt: true } })
  return { inviteUrl: s.inviteTokenHash ? inviteUrl(id) : null, contributions: list }
}

export async function setContributionStatus(id: string, ownerId: string, contributionId: string, status: 'pending' | 'hidden') {
  await ownedSurprise(id, ownerId)
  await db.contribution.updateMany({ where: { id: contributionId, surpriseId: id }, data: { status } })
}

/** Adds the chosen messages to the draft as a "Messages from friends" scene before the finale (as quotes). */
export async function addContributionsToDraft(id: string, ownerId: string, ids: string[]) {
  const s = await ownedSurprise(id, ownerId)
  const picked = await db.contribution.findMany({ where: { surpriseId: id, id: { in: ids }, status: 'pending' }, orderBy: { createdAt: 'asc' }, take: 18 })
  if (!picked.length) throw new AppError(400, 'Pick at least one new message.')
  const doc = await draftDoc(s)
  const scene = {
    id: uid(), kind: 'content' as const, title: 'Messages from friends', transition: 'slide' as const,
    blocks: [
      { id: uid(), type: 'heading' as const, props: { text: `From the people who love you`, size: 'lg', kicker: `${picked.length} message${picked.length > 1 ? 's' : ''}` } },
      ...picked.map((c) => ({ id: uid(), type: 'quote' as const, props: { text: c.message.slice(0, 500), by: c.name } })),
    ],
  }
  const finale = doc.scenes.findIndex((x) => x.kind === 'finale')
  const at = finale < 0 ? doc.scenes.length : finale
  await saveDraftDoc(id, ownerId, parseDoc({ ...doc, scenes: [...doc.scenes.slice(0, at), scene, ...doc.scenes.slice(at)] }), 'manual')
  await db.contribution.updateMany({ where: { id: { in: picked.map((c) => c.id) } }, data: { status: 'added' } })
  return picked.length
}
