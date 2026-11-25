import { route } from '@/lib/http'
import { requireUser } from '@/lib/session'
import { reactionsFor } from '@/server/sharing'

export const GET = route<{ id: string }>(async (_req, { params }) => {
  const user = await requireUser()
  return { reactions: await reactionsFor((await params).id, user.id) }
})
