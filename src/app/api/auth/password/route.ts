import { z } from 'zod'
import { AppError, parseBody, rateLimit, route } from '@/lib/http'
import { requireUser } from '@/lib/session'
import { changePassword } from '@/server/accounts'

export const POST = route(async (req) => {
  rateLimit(req, 'password', 10, 10 * 60_000)
  const user = await requireUser()
  if (user.isGuest) throw new AppError(403, 'Create an account first.')
  const b = await parseBody(req, z.object({ current: z.string().max(200).default(''), next: z.string().max(200) }))
  await changePassword(user.id, b.current, b.next)
  return { ok: true }
})
