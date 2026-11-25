import { db } from '@/lib/db'
import { rateLimit, parseBody, route } from '@/lib/http'
import { StudioInput } from '@/lib/schemas'
import { currentUser, ensureUser } from '@/lib/session'
import { createDraft, shareUrl } from '@/server/surprises'

export const GET = route(async () => {
  const user = await currentUser()
  if (!user) return { surprises: [] }
  const rows = await db.surprise.findMany({
    where: { ownerId: user.id },
    orderBy: { updatedAt: 'desc' },
    include: { deliveries: { orderBy: { scheduledFor: 'asc' } } },
  })
  return {
    surprises: rows.map(({ input: _i, content: _c, linkTokenHash: _h, linkTokenEnc, deliveries, ...s }) => ({
      ...s,
      url: shareUrl({ linkTokenEnc, linkRevokedAt: s.linkRevokedAt }),
      nextDelivery: deliveries.find((d) => d.status === 'SCHEDULED')?.scheduledFor ?? null,
      deliveryCount: deliveries.length,
    })),
  }
})

export const POST = route(async (req) => {
  rateLimit(req, 'create', 30, 60_000)
  const input = await parseBody(req, StudioInput)
  const user = await ensureUser()
  const s = await createDraft(user.id, input)
  return { id: s.id }
})
