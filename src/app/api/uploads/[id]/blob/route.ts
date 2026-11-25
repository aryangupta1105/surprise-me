import { route } from '@/lib/http'
import { requireUser } from '@/lib/session'
import { receiveLocal } from '@/server/media'

/** Upload target when R2 is not configured (local dev). With R2 the browser PUTs to R2 directly. */
export const PUT = route<{ id: string }>(async (req, { params }) => {
  const user = await requireUser()
  await receiveLocal((await params).id, user.id, req.body)
  return { ok: true }
})
