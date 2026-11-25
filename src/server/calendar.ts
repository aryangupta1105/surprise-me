import 'server-only'
import { db } from '@/lib/db'
import { env } from '@/lib/env'
import { AppError } from '@/lib/http'
import { runUserAction } from './integrations'
export { CALENDAR_TIMEZONES } from '@/lib/catalog'

const pad = (n: number) => String(n).padStart(2, '0')

/** occasionDate YYYY-MM-DD minus daysBefore, as the action's DD-MM-YYYY. Pure calendar math, no time zone shift. */
export function reminderDate(occasionDate: string, daysBefore: number) {
  const [y, m, d] = occasionDate.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d - daysBefore))
  return `${pad(date.getUTCDate())}-${pad(date.getUTCMonth() + 1)}-${date.getUTCFullYear()}`
}

/**
 * Creates a short event in the user's own primary Google Calendar on the reminder day.
 * The action has no custom reminder-minutes field (only "use default reminders"), so the event itself is the
 * reminder, placed `daysBefore` days ahead of the occasion at the chosen time.
 */
export async function createReminder(
  userId: string,
  r: { title: string; occasionDate: string; daysBefore: number; time: string; timezone: string; surpriseId?: string; note: string },
) {
  if (r.surpriseId && !(await db.surprise.findFirst({ where: { id: r.surpriseId, ownerId: userId } })))
    throw new AppError(404, 'Surprise not found.')
  const description = [r.note, `Create or send it at ${env.APP_URL}/dashboard`].filter(Boolean).join('\n\n')
  const occasion = new Date(`${r.occasionDate}T00:00:00Z`)
  if (Number.isNaN(occasion.getTime())) throw new AppError(400, 'Not a real date.')
  try {
    const event = await runUserAction(userId, 'calendar', {
      calendar_id: 'primary', // the account's main calendar, right for every user
      summary: r.title,
      description,
      attendees: '',
      timeZone: r.timezone,
      starttime: r.time,
      startdate: reminderDate(r.occasionDate, r.daysBefore),
      meeting_duration: '00:15',
      location: '',
      useDefault: true,
      transparency: 'transparent',
    })
    return db.calendarReminder.create({
      data: {
        userId, surpriseId: r.surpriseId, title: r.title, occasionDate: occasion, remindMinutes: r.daysBefore * 1440,
        timezone: r.timezone, status: 'CREATED', eventId: String(event.id ?? ''), eventLink: String(event.htmlLink ?? '') || null,
      },
    })
  } catch (err) {
    if (err instanceof AppError) throw err
    const body = (err as { body?: { errorMsg?: unknown } }).body
    const message = String(body?.errorMsg ? JSON.stringify(body.errorMsg) : (err as Error).message).slice(0, 500)
    await db.calendarReminder.create({
      data: { userId, surpriseId: r.surpriseId, title: r.title, occasionDate: occasion, remindMinutes: r.daysBefore * 1440, timezone: r.timezone, status: 'FAILED', error: message },
    })
    throw new AppError(502, `Google Calendar refused the reminder: ${message}`, 'calendar_failed')
  }
}
