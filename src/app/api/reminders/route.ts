import { z } from 'zod'
import { db } from '@/lib/db'
import { parseBody, rateLimit, route } from '@/lib/http'
import { requireUser } from '@/lib/session'
import { CALENDAR_TIMEZONES, createReminder } from '@/server/calendar'

const Body = z.object({
  title: z.string().trim().min(1).max(120),
  occasionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((d) => {
    const t = new Date(`${d}T00:00:00Z`)
    return !Number.isNaN(t.getTime()) && t.toISOString().startsWith(d) // rejects 2026-02-30 too
  }, 'Not a real date'),
  daysBefore: z.number().int().min(0).max(60),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  timezone: z.enum(CALENDAR_TIMEZONES),
  note: z.string().trim().max(500).default(''),
  surpriseId: z.string().max(40).optional(),
})

export const GET = route(async () => {
  const user = await requireUser()
  return { reminders: await db.calendarReminder.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' } }) }
})

export const POST = route(async (req) => {
  rateLimit(req, 'reminder', 10, 60_000)
  const user = await requireUser()
  return { reminder: await createReminder(user.id, await parseBody(req, Body)) }
})
