import { z } from 'zod'
import { parseBody, rateLimit, route } from '@/lib/http'
import { createDelivery } from '@/server/delivery'
import { requireUser as me } from '@/lib/session'

const Body = z.object({
  recipientEmail: z.string().trim().email(),
  subject: z.string().trim().min(1).max(150),
  message: z.string().trim().min(1).max(3000),
  sendAt: z.coerce.date().nullish(),
  timezone: z.string().max(60),
  idempotencyKey: z.string().min(8).max(80),
  confirmed: z.literal(true, { message: 'Please confirm you want to send this email.' }),
})

export const POST = route<{ id: string }>(async (req, { params }) => {
  rateLimit(req, 'deliver', 10, 60_000)
  const user = await me()
  const b = await parseBody(req, Body)
  const delivery = await createDelivery((await params).id, user.id, { ...b, sendAt: b.sendAt ?? null })
  return { delivery }
})
