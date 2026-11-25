import { parseBody, rateLimit, route } from '@/lib/http'
import { ensureUser } from '@/lib/session'
import { FromTemplatesInput, createFromTemplates } from '@/server/templates'

/** Creates a surprise by merging one or more templates (composition runs on the server). */
export const POST = route(async (req) => {
  rateLimit(req, 'create', 30, 60_000)
  const body = await parseBody(req, FromTemplatesInput)
  const user = await ensureUser()
  return createFromTemplates(user.id, body)
})
