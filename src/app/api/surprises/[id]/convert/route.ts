import { route } from '@/lib/http'
import { requireUser } from '@/lib/session'
import { convertToScenes } from '@/server/surprises'

/** Moves a single-experience surprise into the scene editor (one-way; the published link is unaffected). */
export const POST = route<{ id: string }>(async (_req, { params }) => {
  const user = await requireUser()
  await convertToScenes((await params).id, user.id)
  return { ok: true }
})
