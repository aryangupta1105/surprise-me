import { z } from 'zod'
import { parseBody, route } from '@/lib/http'
import { publish } from '@/server/surprises'
import { requireUser as me } from '@/lib/session'

const Body = z.object({ expiresAt: z.coerce.date().nullish(), rotate: z.boolean().default(false) })

export const POST = route<{ id: string }>(async (req, { params }) => {
  const user = await me()
  const { expiresAt, rotate } = await parseBody(req, Body)
  return publish((await params).id, user.id, { expiresAt: expiresAt ?? undefined, rotate })
})
