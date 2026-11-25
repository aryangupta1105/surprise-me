import { z } from 'zod'
import { parseBody, rateLimit, route } from '@/lib/http'
import { regenerateSection } from '@/server/ai'
import { requireUser as me } from '@/lib/session'

export const maxDuration = 90
const Body = z.object({ index: z.number().int().min(0).max(20), note: z.string().trim().max(300).default('') })

export const POST = route<{ id: string }>(async (req, { params }) => {
  rateLimit(req, 'regenerate', 12, 60_000)
  const user = await me()
  const { index, note } = await parseBody(req, Body)
  return { item: await regenerateSection((await params).id, user.id, index, note) }
})
