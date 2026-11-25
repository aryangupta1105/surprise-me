// Integration test of the app's real calendar code: one Create_Calendar_Event v24 in the test account's own primary calendar.
// Run: node --env-file=.env --conditions=react-server --import tsx scripts/integration-calendar.mts
import { db } from '../src/lib/db.ts'
import { viasocket } from '../src/lib/viasocket.ts'
import { saveConnection } from '../src/server/integrations.ts'
import { createReminder } from '../src/server/calendar.ts'

const TEST_USER = 'apps-api-test-user'
const ok = (n: string, c: boolean, x = '') => console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${x ? ' — ' + x : ''}`)
const sid = await viasocket().user(TEST_USER).serviceIdFor('google-calendar')
const conn = ((await viasocket().user(TEST_USER).listConnections()) as { id?: string; identifier?: string }[]).find((c) => String(c.identifier ?? c.id).endsWith(sid))
if (!conn) throw new Error('No Google Calendar connection for the test user yet')
await db.user.upsert({ where: { id: TEST_USER }, create: { id: TEST_USER }, update: {} })
await saveConnection(TEST_USER, 'calendar', String(conn.identifier ?? conn.id))

const occasion = new Date(Date.now() + 10 * 864e5).toISOString().slice(0, 10)
const r = await createReminder(TEST_USER, { title: '[SurpriseMe test] Create a surprise', occasionDate: occasion, daysBefore: 3, time: '09:30', timezone: 'Asia/Kolkata', note: 'Automated integration test — safe to delete.' })
ok('reminder created in Google Calendar', r.status === 'CREATED' && !!r.eventId, `event …${r.eventId?.slice(-6)}, link ${r.eventLink ? 'present' : 'missing'}`)

let badDate = false
try { await createReminder(TEST_USER, { title: 'bad', occasionDate: '2026-13-45', daysBefore: 0, time: '09:00', timezone: 'Asia/Kolkata', note: '' }) } catch (e) { badDate = (e as { status?: number }).status === 400 }
ok('impossible date is rejected before calling Google', badDate)

let failed = false
try { await createReminder(TEST_USER, { title: 'bad', occasionDate: occasion, daysBefore: 0, time: '25:99', timezone: 'Asia/Kolkata', note: '' }) } catch (e) { failed = true; console.log('   refusal:', (e as Error).message.slice(0, 160)) }
ok('invalid time is refused by Google and recorded as FAILED', failed && (await db.calendarReminder.count({ where: { userId: TEST_USER, status: 'FAILED' } })) > 0)

await db.calendarReminder.deleteMany({ where: { userId: TEST_USER } })
await db.integrationConnection.deleteMany({ where: { userId: TEST_USER } })
await db.$disconnect()
