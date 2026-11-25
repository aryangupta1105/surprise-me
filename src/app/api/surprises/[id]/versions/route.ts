import { route } from '@/lib/http'
import { requireUser } from '@/lib/session'
import { listVersions } from '@/server/surprises'

export const GET = route<{ id: string }>(async (_req, { params }) => {
  const user = await requireUser()
  return { versions: await listVersions((await params).id, user.id) }
})
