import { db } from '@/lib/db'
import { route } from '@/lib/http'
import { currentUser, endSession, requireUser } from '@/lib/session'
import { disconnect } from '@/server/integrations'
import { deleteMedia } from '@/server/media'
import type { AppKey } from '@/server/integrations'

export const GET = route(async () => {
  const user = await currentUser()
  return { user: user && { id: user.id, isGuest: user.isGuest, email: user.email, name: user.name } }
})

/** Deletes the user and everything they made (cascade), after disconnecting their apps on viaSocket. */
export const DELETE = route(async () => {
  const user = await requireUser()
  const conns = await db.integrationConnection.findMany({ where: { userId: user.id } })
  for (const c of conns) await disconnect(user.id, c.app as AppKey).catch(() => {})
  await deleteMedia({ ownerId: user.id })
  await endSession()
  await db.user.delete({ where: { id: user.id } })
  return { ok: true }
})
