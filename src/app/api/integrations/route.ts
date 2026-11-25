import { z } from 'zod'
import { parseBody, route } from '@/lib/http'
import { currentUser, requireAccount, requireUser } from '@/lib/session'
import { connectParams, disconnect, listConnections, saveConnection } from '@/server/integrations'

const App = z.enum(['gmail', 'calendar'])

/** Connections plus what the browser needs to open the Connect popup (an embed token signed for this user only). */
export const GET = route(async () => {
  const user = await currentUser()
  // Guests see the apps but get no connect token: connecting Gmail/Calendar needs a free account.
  if (!user || user.isGuest) return { connections: [], accountRequired: true }
  const [connections, params] = await Promise.all([listConnections(user.id), connectParams(user.id)])
  return { connections, ...params }
})

export const POST = route(async (req) => {
  const user = await requireAccount('connect your apps')
  const { app, authId } = await parseBody(req, z.object({ app: App, authId: z.string().min(4).max(120) }))
  await saveConnection(user.id, app, authId)
  return { ok: true }
})

export const DELETE = route(async (req) => {
  const user = await requireUser()
  await disconnect(user.id, App.parse(req.nextUrl.searchParams.get('app')))
  return { ok: true }
})
