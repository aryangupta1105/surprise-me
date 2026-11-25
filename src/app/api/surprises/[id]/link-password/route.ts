import { z } from 'zod'
import { parseBody, route } from '@/lib/http'
import { requireUser } from '@/lib/session'
import { setLinkPassword } from '@/server/sharing'

export const POST = route<{ id: string }>(async (req, { params }) => {
  const user = await requireUser()
  const { password } = await parseBody(req, z.object({ password: z.string().max(100).nullable() }))
  await setLinkPassword((await params).id, user.id, password)
  return { ok: true, hasPassword: password !== null }
})
