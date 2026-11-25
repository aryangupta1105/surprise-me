import { route } from '@/lib/http'
import { requireUser } from '@/lib/session'
import { complete } from '@/server/media'

export const POST = route<{ id: string }>(async (_req, { params }) => {
  const user = await requireUser()
  return complete((await params).id, user.id)
})
