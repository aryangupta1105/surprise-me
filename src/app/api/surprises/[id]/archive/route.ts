import { z } from 'zod'
import { parseBody, route } from '@/lib/http'
import { archive } from '@/server/surprises'
import { requireUser as me } from '@/lib/session'

export const POST = route<{ id: string }>(async (req, { params }) => {
  const user = await me()
  const { archived } = await parseBody(req, z.object({ archived: z.boolean() }))
  await archive((await params).id, user.id, archived)
  return { ok: true }
})
