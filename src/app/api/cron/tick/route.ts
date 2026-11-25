import { timingSafeEqual } from 'node:crypto'
import { env } from '@/lib/env'
import { AppError, route } from '@/lib/http'
import { processDueDeliveries } from '@/server/delivery'
import { sweepPending } from '@/server/media'

export const maxDuration = 300

/** Called every few minutes by the viaSocket scheduler flow (scripts/setup-scheduler.mts). */
export const POST = route(async (req) => {
  const given = Buffer.from(req.headers.get('x-cron-secret') ?? '')
  const expected = Buffer.from(env.CRON_SECRET)
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) throw new AppError(401, 'Unauthorized.')
  await sweepPending().catch(() => {})
  return processDueDeliveries()
})
