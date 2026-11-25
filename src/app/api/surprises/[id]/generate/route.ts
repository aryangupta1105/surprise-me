import { rateLimit, route } from '@/lib/http'
import { generateExperience } from '@/server/ai'
import { requireUser as me } from '@/lib/session'

export const maxDuration = 120

export const POST = route<{ id: string }>(async (req, { params }) => {
  rateLimit(req, 'generate', 6, 60_000)
  const user = await me()
  const content = await generateExperience((await params).id, user.id)
  return { content }
})
