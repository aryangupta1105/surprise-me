import { db } from '@/lib/db'
import { AppError, route } from '@/lib/http'
import { requireUser } from '@/lib/session'

/** Creator-side photo preview. Recipients load photos through /api/s/[token]/photo/[id]. */
export const GET = route<{ id: string }>(async (_req, { params }) => {
  const user = await requireUser()
  const up = await db.upload.findFirst({ where: { id: (await params).id, ownerId: user.id } })
  if (!up) throw new AppError(404, 'Not found.')
  return new Response(up.data, { headers: { 'Content-Type': up.mime, 'Cache-Control': 'private, max-age=3600', 'X-Content-Type-Options': 'nosniff' } })
})
