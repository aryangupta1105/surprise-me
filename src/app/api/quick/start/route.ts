import { z } from 'zod'
import { parseBody, rateLimit, route } from '@/lib/http'
import { ensureUser } from '@/lib/session'
import { Brief, briefToInput } from '@/server/quick'
import { createDraft } from '@/server/surprises'

/** Creates the draft surprise from the (creator-corrected) brief, so photos can be attached before composing. */
export const POST = route(async (req) => {
  rateLimit(req, 'create', 30, 60_000)
  const { brief } = await parseBody(req, z.object({ brief: Brief.extend({ creatorName: z.string().trim().min(1, 'Add your name').max(60), recipientName: z.string().trim().min(1, 'Who is it for?').max(60) }) }))
  const user = await ensureUser()
  const s = await createDraft(user.id, briefToInput(brief))
  return { id: s.id }
})
