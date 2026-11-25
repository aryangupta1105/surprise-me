import { z } from 'zod'
import { parseBody, route } from '@/lib/http'
import { requireUser } from '@/lib/session'
import { insertIntoSurprise } from '@/server/templates'

/** Inserts a template's scenes into the editor's current document and returns the result (not saved here). */
export const POST = route<{ id: string }>(async (req, { params }) => {
  const user = await requireUser()
  const b = await parseBody(req, z.object({ doc: z.unknown(), templateId: z.string().max(60), at: z.number().int().min(0).max(30), keepTemplateColours: z.boolean().default(false) }))
  return insertIntoSurprise((await params).id, user.id, b.doc, b.templateId, b.at, b.keepTemplateColours)
})
