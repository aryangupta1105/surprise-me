import { route } from '@/lib/http'
import { requireUser } from '@/lib/session'
import { versionDoc } from '@/server/surprises'

export const GET = route<{ id: string; versionId: string }>(async (_req, { params }) => {
  const user = await requireUser()
  const { id, versionId } = await params
  return { doc: await versionDoc(id, user.id, versionId) }
})
