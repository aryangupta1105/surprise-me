import { timingSafeEqual } from 'node:crypto'
import { env } from '@/lib/env'
import { AppError, log, route } from '@/lib/http'
import { processDueDeliveries } from '@/server/delivery'
import { sweepPending } from '@/server/media'
import { backupIfDue } from '@/server/backup'

export const maxDuration = 300

/** Called every few minutes by the viaSocket scheduler flow (scripts/setup-scheduler.mts). */
export const POST = route(async (req) => {
  const given = Buffer.from(req.headers.get('x-cron-secret') ?? '')
  const expected = Buffer.from(env.TICK_SECRET)
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) throw new AppError(401, 'Unauthorized.')
  await sweepPending().catch(() => {})
  await backupIfDue().catch((e) => log('error', 'backup failed', { error: String(e) }))
  return processDueDeliveries()
})
