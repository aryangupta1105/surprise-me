import { z } from 'zod'
import { parseBody, rateLimit, route } from '@/lib/http'
import { ensureUser } from '@/lib/session'
import { extractBrief } from '@/server/quick'

export const maxDuration = 60

export const POST = route(async (req) => {
  rateLimit(req, 'extract', 10, 60_000)
  const { description } = await parseBody(req, z.object({ description: z.string().trim().min(15, 'Tell us a little more — who is it for and what is the occasion?').max(3000) }))
  const user = await ensureUser()
  return { brief: await extractBrief(user.id, description) }
})
