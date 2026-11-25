import { z } from 'zod'
import { parseBody, rateLimit, route } from '@/lib/http'
import { recordEngagement } from '@/server/surprises'

const Body = z.discriminatedUnion('type', [
  z.object({ type: z.literal('open') }),
  z.object({ type: z.literal('progress'), percent: z.number().min(0).max(100) }),
])

export const POST = route<{ token: string }>(async (req, { params }) => {
  rateLimit(req, 'engagement', 60, 60_000)
  await recordEngagement((await params).token, await parseBody(req, Body))
  return { ok: true }
})
