import { z } from 'zod'
import { parseBody, rateLimit, route } from '@/lib/http'
import { EXPERIENCES, PALETTES } from '@/lib/schemas'
import { requireUser } from '@/lib/session'
import { composeDraft } from '@/server/quick'

export const maxDuration = 180

const Body = z.object({
  experiences: z.array(z.enum(EXPERIENCES)).min(1).max(3),
  photoIds: z.array(z.string().max(40)).max(12).default([]),
  palette: z.enum(PALETTES).optional(),
})

export const POST = route<{ id: string }>(async (req, { params }) => {
  rateLimit(req, 'generate', 6, 60_000)
  const user = await requireUser()
  const b = await parseBody(req, Body)
  const doc = await composeDraft((await params).id, user.id, { experiences: [...new Set(b.experiences)], photoIds: b.photoIds, palette: b.palette })
  return { doc }
})
