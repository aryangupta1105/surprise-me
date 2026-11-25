import { z } from 'zod'
import { parseBody, rateLimit, route } from '@/lib/http'
import { requireUser } from '@/lib/session'
import { runAssistant } from '@/server/assistant'

/** Turns a creator's instruction into validated edits of their current document; returns the result (not saved here). */
export const POST = route<{ id: string }>(async (req, { params }) => {
  rateLimit(req, 'assistant', 20, 60_000)
  const user = await requireUser()
  const b = await parseBody(req, z.object({ doc: z.unknown(), instruction: z.string().trim().min(3, 'Tell the assistant what to change.').max(1000) }))
  return runAssistant((await params).id, user.id, b.doc, b.instruction)
})
