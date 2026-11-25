import { z } from 'zod'
import { parseBody, rateLimit, route } from '@/lib/http'
import { requireUser } from '@/lib/session'
import { rewriteBlock } from '@/server/assistant'

/** Rewrites one block's props with AI (media kept) and returns the document (not saved here). */
export const POST = route<{ id: string }>(async (req, { params }) => {
  rateLimit(req, 'assistant', 20, 60_000)
  const user = await requireUser()
  const b = await parseBody(req, z.object({ doc: z.unknown(), sceneId: z.string().max(40), blockId: z.string().max(40), note: z.string().trim().max(300).default('') }))
  return rewriteBlock((await params).id, user.id, b.doc, b.sceneId, b.blockId, b.note)
})
