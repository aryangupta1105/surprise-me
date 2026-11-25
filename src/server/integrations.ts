import 'server-only'
import { db } from '@/lib/db'
import { AppError, log } from '@/lib/http'
import { viasocket } from '@/lib/viasocket'

// Every id below was read from viaSocket's docs (gmail.md, google-calendar.md, fetched 2026-11-25)
// and checked by `npx viasocket-apps check`. Versions are pinned to the inputData shape we send.
export const APPS = {
  gmail: { slug: 'gmail', label: 'Gmail', action: 'Send_Email', version: 'v56', actionId: 'rowogelpy0h6' },
  calendar: {
    slug: 'google-calendar',
    label: 'Google Calendar',
    action: 'Create_Calendar_Event',
    version: 'v24',
    actionId: 'rowuitv4m6uy',
  },
} as const
export type AppKey = keyof typeof APPS
// Tested 2026-11-25: the live answer carries the auth_id as `id` (docs say `identifier`); accept both.
type RawConnection = { id?: string; identifier?: string; connection_label?: string; isExpired?: boolean }
type LiveConnection = { authId: string; label: string | null; isExpired: boolean }
function labelOf(raw?: string) {
  if (!raw) return null
  try {
    return Object.values(JSON.parse(raw) as Record<string, string>)[0] ?? raw
  } catch {
    return raw
  }
}
const liveConnections = async (userId: string): Promise<LiveConnection[]> =>
  ((await viasocket().user(userId).listConnections()) as RawConnection[]).map((c) => ({
    authId: String(c.identifier ?? c.id),
    label: labelOf(c.connection_label),
    isExpired: Boolean(c.isExpired),
  }))

export const appKeyFromSlug = (slug: string) =>
  (Object.keys(APPS) as AppKey[]).find((k) => APPS[k].slug === slug) ?? null

/** What the browser needs to open the Connect popup for this user: a signed embed token and service ids. */
export async function connectParams(userId: string) {
  const user = viasocket().user(userId)
  const entries = await Promise.all(
    (Object.keys(APPS) as AppKey[]).map(async (k) => [k, { serviceId: await user.serviceIdFor(APPS[k].slug), actionId: APPS[k].actionId }] as const),
  )
  return { token: await user.token(), apps: Object.fromEntries(entries) }
}

/** Stores a connection after checking with viaSocket that this auth_id really is this user's. */
export async function saveConnection(userId: string, app: AppKey, authId: string) {
  const conns = await liveConnections(userId)
  const match = conns.find((c) => c.authId === authId)
  if (!match) throw new AppError(400, 'That connection was not found for your account.')
  return db.integrationConnection.upsert({
    where: { userId_app: { userId, app } },
    create: { userId, app, authId, label: match.label },
    update: { authId, label: match.label },
  })
}

export async function listConnections(userId: string) {
  const rows = await db.integrationConnection.findMany({ where: { userId } })
  let live: LiveConnection[] = []
  try {
    live = await liveConnections(userId)
  } catch (err) {
    log('warn', 'listConnections failed', { error: String(err) })
  }
  return rows.map((r) => ({
    app: r.app as AppKey,
    label: r.label,
    authId: r.authId, // returned only to its owner: the Connect popup needs it to reconnect in place
    expired: Boolean(live.find((c) => c.authId === r.authId)?.isExpired),
    missing: live.length > 0 && !live.some((c) => c.authId === r.authId),
  }))
}

export async function disconnect(userId: string, app: AppKey) {
  const row = await db.integrationConnection.findUnique({ where: { userId_app: { userId, app } } })
  if (!row) return
  const user = viasocket().user(userId)
  const scriptId = await user.findEnabled(APPS[app].slug)
  if (scriptId) await user.setFlowStatus(scriptId, 2) // pause flows before revoking, as manage.md says
  await user.revokeConnection(row.authId).catch((err) => log('warn', 'revokeConnection failed', { error: String(err) }))
  await db.integrationConnection.delete({ where: { id: row.id } })
}

/** Runs one pinned action through this user's own connection. The script_id never leaves the server. */
export async function runUserAction(userId: string, app: AppKey, inputData: Record<string, unknown>) {
  const conn = await db.integrationConnection.findUnique({ where: { userId_app: { userId, app } } })
  if (!conn) throw new AppError(400, `Connect ${APPS[app].label} first.`, 'not_connected')
  const user = viasocket().user(userId)
  const scriptId = (await user.findEnabled(APPS[app].slug)) ?? (await user.enable(APPS[app].slug, conn.authId)).scriptId
  return viasocket().runAction<Record<string, unknown>>(scriptId, APPS[app].action, inputData, { version: APPS[app].version })
}
