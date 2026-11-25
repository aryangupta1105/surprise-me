import 'server-only'
import { ViaSocket } from 'viasocket-apps'
import { env } from './env'
import { AppError } from './http'

let client: ViaSocket | null = null

/** The viaSocket client. Every per-user call goes through viasocket().user(User.id), never an email. */
export function viasocket() {
  if (!env.VIASOCKET_EMBED_SECRET)
    throw new AppError(503, 'viaSocket is not set up yet (missing embed secret on the server).', 'viasocket_not_configured')
  client ??= new ViaSocket({ orgId: env.VIASOCKET_ORG_ID, projectId: env.VIASOCKET_PROJECT_ID, secret: env.VIASOCKET_EMBED_SECRET })
  return client
}
