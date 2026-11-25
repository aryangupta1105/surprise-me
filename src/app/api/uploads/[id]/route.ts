import { db } from '@/lib/db'
import { AppError, route } from '@/lib/http'
import { requireUser } from '@/lib/session'
import { deleteMedia, respond } from '@/server/media'

/** Creator-side media. Recipients load media through /api/s/[token]/photo/[id]. */
export const GET = route<{ id: string }>(async (req, { params }) => {
  const user = await requireUser()
  const up = await db.upload.findFirst({ where: { id: (await params).id, ownerId: user.id, status: 'ready' } })
  if (!up) throw new AppError(404, 'Not found.')
  return respond(up, req.headers.get('range'))
})

export const DELETE = route<{ id: string }>(async (_req, { params }) => {
  const user = await requireUser()
  await deleteMedia({ id: (await params).id, ownerId: user.id })
  return { ok: true }
})
