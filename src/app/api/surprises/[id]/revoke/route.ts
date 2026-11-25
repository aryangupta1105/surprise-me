import { route } from '@/lib/http'
import { revokeLink } from '@/server/surprises'
import { requireUser as me } from '@/lib/session'

export const POST = route<{ id: string }>(async (_req, { params }) => {
  const user = await me()
  await revokeLink((await params).id, user.id)
  return { ok: true }
})
