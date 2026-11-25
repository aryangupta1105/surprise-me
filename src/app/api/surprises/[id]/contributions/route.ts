import { z } from 'zod'
import { parseBody, route } from '@/lib/http'
import { requireUser } from '@/lib/session'
import { addContributionsToDraft, contributionsFor, setContributionStatus, setInvite } from '@/server/sharing'

export const GET = route<{ id: string }>(async (_req, { params }) => {
  const user = await requireUser()
  return contributionsFor((await params).id, user.id)
})

const Action = z.discriminatedUnion('action', [
  z.object({ action: z.literal('invite'), on: z.boolean() }),
  z.object({ action: z.literal('add'), ids: z.array(z.string().max(40)).min(1).max(18) }),
  z.object({ action: z.literal('status'), contributionId: z.string().max(40), status: z.enum(['pending', 'hidden']) }),
])

export const POST = route<{ id: string }>(async (req, { params }) => {
  const user = await requireUser()
  const id = (await params).id
  const a = await parseBody(req, Action)
  if (a.action === 'invite') return { inviteUrl: await setInvite(id, user.id, a.on) }
  if (a.action === 'add') return { added: await addContributionsToDraft(id, user.id, a.ids) }
  await setContributionStatus(id, user.id, a.contributionId, a.status)
  return { ok: true }
})
