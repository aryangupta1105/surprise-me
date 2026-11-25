import { z } from 'zod'
import { parseBody, route } from '@/lib/http'
import { StoredContent, StudioInput, Theme } from '@/lib/schemas'
import { requireUser as me } from '@/lib/session'
import { draftDoc, ownedSurprise, remove, saveContent, shareUrl, updateInput } from '@/server/surprises'
import { db } from '@/lib/db'

type P = { id: string }

export const GET = route<P>(async (_req, { params }) => {
  const user = await me()
  const { id } = await params
  const s = await ownedSurprise(id, user.id)
  const [deliveries, reminders] = await Promise.all([
    db.delivery.findMany({ where: { surpriseId: id }, orderBy: { createdAt: 'desc' } }),
    db.calendarReminder.findMany({ where: { surpriseId: id }, orderBy: { createdAt: 'desc' } }),
  ])
  const { linkTokenHash: _h, linkTokenEnc, ...rest } = s
  const doc = s.draftVersionId ? await draftDoc(s) : null
  return { surprise: { ...rest, url: shareUrl({ linkTokenEnc, linkRevokedAt: s.linkRevokedAt }) }, doc, deliveries, reminders }
})

const Patch = z.union([
  z.object({ input: StudioInput }),
  z.object({ content: StoredContent, theme: Theme.optional() }),
])

export const PATCH = route<P>(async (req, { params }) => {
  const user = await me()
  const { id } = await params
  const body = await parseBody(req, Patch)
  if ('input' in body) await updateInput(id, user.id, body.input)
  else await saveContent(id, user.id, body.content, body.theme)
  return { ok: true }
})

export const DELETE = route<P>(async (_req, { params }) => {
  const user = await me()
  await remove((await params).id, user.id)
  return { ok: true }
})
