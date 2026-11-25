import { z } from 'zod'
import { parseBody, route } from '@/lib/http'
import { requireUser } from '@/lib/session'
import { saveDraftDoc } from '@/server/surprises'

/** Saves an edited scene document as a new draft version (validated against the block registry). */
export const PUT = route<{ id: string }>(async (req, { params }) => {
  const user = await requireUser()
  const { doc, source } = await parseBody(req, z.object({ doc: z.unknown(), source: z.enum(['manual', 'autosave']).default('manual') }))
  const v = await saveDraftDoc((await params).id, user.id, doc, source)
  return { versionId: v.id }
})
