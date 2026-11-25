import { db } from '@/lib/db'
import { AppError, route } from '@/lib/http'
import { openByToken } from '@/server/surprises'

export const GET = route<{ token: string; photoId: string }>(async (_req, { params }) => {
  const { token, photoId } = await params
  const s = await openByToken(token)
  const up = s && (await db.upload.findFirst({ where: { id: photoId, surpriseId: s.id } }))
  if (!up) throw new AppError(404, 'Not found.')
  return new Response(up.data, { headers: { 'Content-Type': up.mime, 'Cache-Control': 'private, max-age=3600', 'X-Content-Type-Options': 'nosniff', 'X-Robots-Tag': 'noindex' } })
})
