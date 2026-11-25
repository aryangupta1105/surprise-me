import { route } from '@/lib/http'
import { duplicate } from '@/server/surprises'
import { requireUser as me } from '@/lib/session'

export const POST = route<{ id: string }>(async (_req, { params }) => {
  const user = await me()
  const copy = await duplicate((await params).id, user.id)
  return { id: copy.id }
})
