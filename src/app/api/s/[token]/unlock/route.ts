import { z } from 'zod'
import { parseBody, rateLimit, route } from '@/lib/http'
import { unlockLink } from '@/server/sharing'

export const POST = route<{ token: string }>(async (req, { params }) => {
  rateLimit(req, 'unlock', 10, 10 * 60_000) // slows guessing
  const { password } = await parseBody(req, z.object({ password: z.string().max(100) }))
  await unlockLink((await params).token, password)
  return { ok: true }
})
