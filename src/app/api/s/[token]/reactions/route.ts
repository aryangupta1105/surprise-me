import { parseBody, rateLimit, route } from '@/lib/http'
import { ReactionInput, addReaction } from '@/server/sharing'

/** The recipient's reply to the creator. No account, no identity beyond the name they choose to give. */
export const POST = route<{ token: string }>(async (req, { params }) => {
  rateLimit(req, 'react', 6, 10 * 60_000)
  await addReaction((await params).token, await parseBody(req, ReactionInput))
  return { ok: true }
})
