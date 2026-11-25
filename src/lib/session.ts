import 'server-only'
import { cookies } from 'next/headers'
import { db } from './db'
import { randomToken, sha256 } from './crypto'
import { AppError } from './http'

const COOKIE = 'sm_session'
const MAX_AGE_DAYS = 365

/** The signed-in user (guest or account) for this request, or null. Never creates anything. */
export async function currentUser() {
  const token = (await cookies()).get(COOKIE)?.value
  if (!token) return null
  const session = await db.session.findUnique({ where: { tokenHash: sha256(token) }, include: { user: true } })
  if (!session || session.expiresAt < new Date()) return null
  return session.user
}

/** The current user, creating an anonymous guest + session when there is none. Route handlers / actions only. */
export async function ensureUser() {
  const existing = await currentUser()
  if (existing) return existing
  const user = await db.user.create({ data: { isGuest: true } })
  await startSession(user.id)
  return user
}

export async function startSession(userId: string) {
  const token = randomToken()
  const expiresAt = new Date(Date.now() + MAX_AGE_DAYS * 864e5)
  await db.session.create({ data: { tokenHash: sha256(token), userId, expiresAt } })
  ;(await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: expiresAt,
  })
}

export async function endSession() {
  const jar = await cookies()
  const token = jar.get(COOKIE)?.value
  if (token) await db.session.deleteMany({ where: { tokenHash: sha256(token) } })
  jar.delete(COOKIE)
}

/** The current user or a 401. For routes that act on existing data. */
export async function requireUser() {
  const user = await currentUser()
  if (!user) throw new AppError(401, 'Your session has ended. Start a new surprise.', 'no_session')
  return user
}

/** Things that act in the world on someone's behalf (sending email, calendar events, app connections) need a free account. */
export async function requireAccount(action = 'do this') {
  const user = await requireUser()
  if (user.isGuest) throw new AppError(403, `Create a free account to ${action} — it takes a few seconds and keeps everything you've made.`, 'account_required')
  return user
}
