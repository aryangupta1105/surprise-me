import 'server-only'
import { db } from '@/lib/db'
import { AppError } from '@/lib/http'
import { currentUser, startSession } from '@/lib/session'

// 36Blocks (viaSocket's login product): https://viasocket.com/docs/skill/login-and-orgs.md
const BLOCKS_API = 'https://routes.msg91.com/api'

type BlocksUser = { id: string | number; name?: string; email?: string }

async function blocksUser(proxyAuthToken: string): Promise<BlocksUser> {
  const res = await fetch(`${BLOCKS_API}/c/getDetails`, { headers: { proxy_auth_token: proxyAuthToken } })
  const body = (await res.json().catch(() => null)) as { data?: BlocksUser[] } | null
  const u = body?.data?.[0]
  if (!res.ok || !u?.id) throw new AppError(401, 'Sign-in could not be verified.')
  return u
}

/**
 * Completes an account sign-in. A guest who signs up keeps the same User row (and so the same viaSocket
 * user id, drafts, surprises and connections). Signing in to an existing account moves the guest's
 * surprises and reminders into it; the guest's app connections stay with the guest and must be reconnected.
 */
export async function completeSignIn(proxyAuthToken: string) {
  const bu = await blocksUser(proxyAuthToken)
  // We only use the 36Blocks token to learn who signed in; our own session cookie carries the login after this.
  await fetch(`${BLOCKS_API}/c/logout`, { method: 'DELETE', headers: { proxy_auth_token: proxyAuthToken } }).catch(() => {})
  const externalId = String(bu.id)
  const guest = await currentUser()
  const account = await db.user.findUnique({ where: { externalId } })

  if (!account) {
    const user = guest?.isGuest
      ? await db.user.update({ where: { id: guest.id }, data: { isGuest: false, externalId, email: bu.email ?? null, name: bu.name ?? null } })
      : await db.user.create({ data: { isGuest: false, externalId, email: bu.email ?? null, name: bu.name ?? null } })
    if (!guest?.isGuest) await startSession(user.id)
    return user
  }
  if (guest?.isGuest && guest.id !== account.id) {
    await db.$transaction([
      db.surprise.updateMany({ where: { ownerId: guest.id }, data: { ownerId: account.id } }),
      db.upload.updateMany({ where: { ownerId: guest.id }, data: { ownerId: account.id } }),
      db.calendarReminder.updateMany({ where: { userId: guest.id }, data: { userId: account.id } }),
      db.session.deleteMany({ where: { userId: guest.id } }),
    ])
  }
  await startSession(account.id)
  return account
}
