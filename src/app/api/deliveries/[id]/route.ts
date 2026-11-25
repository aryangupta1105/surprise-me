import { z } from 'zod'
import { parseBody, route } from '@/lib/http'
import { cancelDelivery, rescheduleDelivery, retryDelivery } from '@/server/delivery'
import { requireUser as me } from '@/lib/session'

const Body = z.discriminatedUnion('action', [
  z.object({ action: z.literal('cancel') }),
  z.object({ action: z.literal('retry') }),
  z.object({ action: z.literal('reschedule'), sendAt: z.coerce.date(), timezone: z.string().max(60) }),
])

export const POST = route<{ id: string }>(async (req, { params }) => {
  const user = await me()
  const { id } = await params
  const b = await parseBody(req, Body)
  if (b.action === 'cancel') await cancelDelivery(id, user.id)
  if (b.action === 'retry') return { delivery: await retryDelivery(id, user.id) }
  if (b.action === 'reschedule') await rescheduleDelivery(id, user.id, b.sendAt, b.timezone)
  return { ok: true }
})
