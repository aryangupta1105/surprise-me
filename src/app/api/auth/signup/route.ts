import { parseBody, rateLimit, route } from '@/lib/http'
import { Credentials, signUp } from '@/server/accounts'

/** Optional free account. A guest who signs up keeps everything they made. */
export const POST = route(async (req) => {
  rateLimit(req, 'signup', 5, 10 * 60_000)
  const u = await signUp(await parseBody(req, Credentials))
  return { user: { id: u.id, email: u.email, name: u.name, isGuest: false } }
})
