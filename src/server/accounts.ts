import 'server-only'
import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto'
import { z } from 'zod'
import { db } from '@/lib/db'
import { AppError } from '@/lib/http'
import { currentUser, endSession, startSession } from '@/lib/session'

// Accounts are optional. Everyone starts as a guest (a User row + cookie); an account is the same row with an
// email, so signing up never moves or loses anything. Two ways in: email + password (built in, always on) and
// 36Blocks (Google etc.) when NEXT_PUBLIC_BLOCKS_REFERENCE_ID is configured.

/** Starts a fresh session for `account`, bringing a guest's work along when a guest signs in. */
async function signInAs<T extends { id: string }>(account: T): Promise<T> {
  const guest = await currentUser()
  if (guest?.isGuest && guest.id !== account.id) {
    await db.$transaction([
      db.surprise.updateMany({ where: { ownerId: guest.id }, data: { ownerId: account.id } }),
      db.upload.updateMany({ where: { ownerId: guest.id }, data: { ownerId: account.id } }),
      db.calendarReminder.updateMany({ where: { userId: guest.id }, data: { userId: account.id } }),
    ])
  }
  await endSession() // new cookie on every sign-in (no session fixation)
  await startSession(account.id)
  return account
}

// ---------- Email + password ----------

const scrypt = (pw: string, salt: Buffer) =>
  new Promise<Buffer>((ok, fail) => scryptCb(pw.normalize('NFKC'), salt, 32, { N: 16384, r: 8, p: 1 }, (e, k) => (e ? fail(e) : ok(k))))

export async function hashPassword(pw: string) {
  const salt = randomBytes(16)
  return ['scrypt', salt.toString('base64'), (await scrypt(pw, salt)).toString('base64')].join('$')
}

export async function verifyPassword(pw: string, stored: string) {
  const [alg, salt, hash] = stored.split('$')
  if (alg !== 'scrypt' || !salt || !hash) return false
  const got = await scrypt(pw, Buffer.from(salt, 'base64'))
  const want = Buffer.from(hash, 'base64')
  return got.length === want.length && timingSafeEqual(got, want)
}

export const Credentials = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address.').max(200),
  password: z.string().min(8, 'Use at least 8 characters.').max(200),
  name: z.string().trim().max(60).optional(),
})

/** Sign up: the current guest becomes the account (same id: drafts, surprises, media and connections stay). */
export async function signUp(input: z.input<typeof Credentials>) {
  const c = Credentials.parse(input)
  if (await db.user.findUnique({ where: { email: c.email } })) throw new AppError(409, 'That email already has an account — sign in instead.', 'exists')
  const passwordHash = await hashPassword(c.password)
  const guest = await currentUser()
  if (guest && !guest.isGuest) throw new AppError(400, 'You are already signed in.')
  const data = { isGuest: false, email: c.email, name: c.name || null, passwordHash }
  if (guest) {
    const user = await db.user.update({ where: { id: guest.id }, data })
    await endSession()
    await startSession(user.id) // new cookie at the privilege change
    return user
  }
  const user = await db.user.create({ data })
  await startSession(user.id)
  return user
}

// A wrong email costs the same scrypt work as a wrong password, so timing doesn't reveal who has an account.
let dummy: Promise<string> | undefined
export async function signIn(input: { email: string; password: string }) {
  const email = String(input.email ?? '').trim().toLowerCase()
  const account = await db.user.findUnique({ where: { email } })
  const stored = account?.passwordHash ?? (await (dummy ??= hashPassword(randomBytes(12).toString('hex'))))
  const ok = await verifyPassword(String(input.password ?? ''), stored)
  if (!account?.passwordHash || !ok) throw new AppError(401, 'That email and password don’t match.', 'bad_credentials')
  return signInAs(account)
}

export async function changePassword(userId: string, current: string, next: string) {
  const u = await db.user.findUniqueOrThrow({ where: { id: userId } })
  if (u.passwordHash && !(await verifyPassword(current, u.passwordHash))) throw new AppError(401, 'Your current password is not right.')
  const pw = Credentials.shape.password.parse(next)
  await db.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(pw) } })
  await db.session.deleteMany({ where: { userId } }) // signs out every other device
  await endSession()
  await startSession(userId)
}

// ---------- 36Blocks (optional; viaSocket's login product) ----------
// https://viasocket.com/docs/skill/login-and-orgs.md
const BLOCKS_API = 'https://routes.msg91.com/api'
type BlocksUser = { id: string | number; name?: string; email?: string }

async function blocksUser(proxyAuthToken: string): Promise<BlocksUser> {
  const res = await fetch(`${BLOCKS_API}/c/getDetails`, { headers: { proxy_auth_token: proxyAuthToken } })
  const body = (await res.json().catch(() => null)) as { data?: BlocksUser[] } | null
  const u = body?.data?.[0]
  if (!res.ok || !u?.id) throw new AppError(401, 'Sign-in could not be verified.')
  return u
}

export async function completeSignIn(proxyAuthToken: string) {
  const bu = await blocksUser(proxyAuthToken)
  // We only use the 36Blocks token to learn who signed in; our own session cookie carries the login after this.
  await fetch(`${BLOCKS_API}/c/logout`, { method: 'DELETE', headers: { proxy_auth_token: proxyAuthToken } }).catch(() => {})
  const externalId = String(bu.id)
  const guest = await currentUser()
  // Matched by the provider's id only, never by email (that would let a provider account take over a password account).
  const account = await db.user.findUnique({ where: { externalId } })
  if (account) return signInAs(account)
  const email = bu.email?.toLowerCase()
  const emailFree = email && !(await db.user.findUnique({ where: { email } }))
  const data = { isGuest: false, externalId, email: emailFree ? email : null, name: bu.name ?? null }
  if (guest?.isGuest) {
    const user = await db.user.update({ where: { id: guest.id }, data })
    await endSession()
    await startSession(user.id)
    return user
  }
  const user = await db.user.create({ data })
  await startSession(user.id)
  return user
}
