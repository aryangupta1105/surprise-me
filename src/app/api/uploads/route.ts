import { z } from 'zod'
import { parseBody, rateLimit, route } from '@/lib/http'
import { ensureUser, requireUser } from '@/lib/session'
import { KINDS, StartInput, list, start } from '@/server/media'

/** Reserve an upload; the browser then sends the file to the returned URL and calls /complete. */
export const POST = route(async (req) => {
  rateLimit(req, 'upload', 40, 60_000)
  const body = await parseBody(req, StartInput)
  const user = await ensureUser()
  return start(user.id, body)
})

/** The surprise's media library. */
export const GET = route(async (req) => {
  const user = await requireUser()
  const q = z.object({ surpriseId: z.string().max(40), kind: z.enum(KINDS).optional() }).parse(Object.fromEntries(req.nextUrl.searchParams))
  return { media: await list(user.id, q.surpriseId, q.kind) }
})
