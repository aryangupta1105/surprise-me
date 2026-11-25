import { db } from '@/lib/db'
import { AppError, route } from '@/lib/http'
import { respond } from '@/server/media'
import { openByToken } from '@/server/surprises'

/** Recipient-side media (photos, audio, video) for a published surprise. */
export const GET = route<{ token: string; photoId: string }>(async (req, { params }) => {
  const { token, photoId } = await params
  const s = await openByToken(token)
  const up = s && (await db.upload.findFirst({ where: { id: photoId, surpriseId: s.id, status: 'ready' } }))
  if (!up) throw new AppError(404, 'Not found.')
  return respond(up, req.headers.get('range'))
})
