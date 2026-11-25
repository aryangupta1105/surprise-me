import { z } from 'zod'
import { parseBody, rateLimit, route } from '@/lib/http'
import { signIn } from '@/server/accounts'

export const POST = route(async (req) => {
  rateLimit(req, 'signin', 10, 10 * 60_000) // slows password guessing
  const b = await parseBody(req, z.object({ email: z.string().max(200), password: z.string().max(200) }))
  const u = await signIn(b)
  return { user: { id: u.id, email: u.email, name: u.name, isGuest: false } }
})
