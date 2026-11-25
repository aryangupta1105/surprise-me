import { parseBody, rateLimit, route } from '@/lib/http'
import { ContributionInput, contribute } from '@/server/sharing'

/** A friend adds a message through the creator's invite link. The creator decides what goes in. */
export const POST = route<{ token: string }>(async (req, { params }) => {
  rateLimit(req, 'contribute', 5, 10 * 60_000)
  await contribute((await params).token, await parseBody(req, ContributionInput))
  return { ok: true }
})
