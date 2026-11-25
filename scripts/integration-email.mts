// Integration test of the app's real delivery code against viaSocket + Gmail.
// Uses viaSocket's documented test user `apps-api-test-user` and sends ONLY to that test account's own address.
// Run: node --env-file=.env --conditions=react-server --import tsx scripts/integration-email.mts
import { db } from '../src/lib/db.ts'
import { viasocket } from '../src/lib/viasocket.ts'
import { saveConnection } from '../src/server/integrations.ts'
import { createDelivery, processDueDeliveries } from '../src/server/delivery.ts'
import { publish } from '../src/server/surprises.ts'

const TEST_USER = 'apps-api-test-user'
const ok = (name: string, cond: boolean, extra = '') => console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`)

const serviceId = await viasocket().user(TEST_USER).serviceIdFor('gmail')
const raw = (await viasocket().user(TEST_USER).listConnections()) as { id?: string; identifier?: string; connection_label?: string }[]
const gmail = raw.find((c) => String(c.identifier ?? c.id).endsWith(serviceId))!
const authId = String(gmail.identifier ?? gmail.id)
const testAddress = Object.values(JSON.parse(gmail.connection_label ?? '{}') as Record<string, string>)[0]

await db.user.upsert({ where: { id: TEST_USER }, create: { id: TEST_USER, isGuest: true }, update: {} })
await saveConnection(TEST_USER, 'gmail', authId)
ok('saveConnection verifies auth_id against viaSocket', true)
let rejected = false
try { await saveConnection(TEST_USER, 'gmail', 'not-a-real-auth-id') } catch { rejected = true }
ok('saveConnection rejects an auth_id the user does not own', rejected)

const content = { type: 'cards', title: 'Integration test', subtitle: 's', intro: 'i', palette: 'candy', closing: { title: 't', message: 'm' }, deckTitle: 'd', cards: Array.from({ length: 5 }, (_, i) => ({ emoji: '⭐', heading: `h${i}`, body: 'b' })) }
const s = await db.surprise.create({ data: { ownerId: TEST_USER, occasion: 'birthday', recipientName: 'Test', creatorName: 'SurpriseMe QA', input: {}, content, generationStatus: 'SUCCEEDED' } })
await publish(s.id, TEST_USER)

// 1. Immediate send succeeds.
const run = Date.now()
const sent = await createDelivery(s.id, TEST_USER, { recipientEmail: testAddress, subject: `[SurpriseMe test ${run}] immediate`, message: 'Automated integration test.', sendAt: null, timezone: 'Asia/Kolkata', idempotencyKey: `it-now-${run}` })
ok('immediate email is SENT via Gmail', sent.status === 'SENT', sent.lastError ?? '')

// 2. Same idempotency key does not send twice.
const again = await createDelivery(s.id, TEST_USER, { recipientEmail: testAddress, subject: 'dup', message: 'dup', sendAt: null, timezone: 'UTC', idempotencyKey: `it-now-${run}` })
ok('repeated request with same key returns the first delivery', again.id === sent.id && (await db.delivery.count({ where: { surpriseId: s.id } })) === 1)

// 3. Scheduled delivery fires once even when two scheduler ticks overlap.
const sched = await createDelivery(s.id, TEST_USER, { recipientEmail: testAddress, subject: `[SurpriseMe test ${run}] scheduled`, message: 'Scheduled integration test.', sendAt: new Date(Date.now() + 2000), timezone: 'Asia/Kolkata', idempotencyKey: `it-sched-${run}` })
ok('scheduled delivery is stored as SCHEDULED', sched.status === 'SCHEDULED')
const early = await processDueDeliveries()
ok('tick before due time sends nothing for it', (await db.delivery.findUnique({ where: { id: sched.id } }))!.status === 'SCHEDULED', JSON.stringify(early))
await new Promise((r) => setTimeout(r, 2500))
const [a, b] = await Promise.all([processDueDeliveries(), processDueDeliveries()])
const after = (await db.delivery.findUnique({ where: { id: sched.id } }))!
ok('overlapping ticks send the scheduled email exactly once', after.status === 'SENT' && after.attempts === 1 && a.sent + b.sent === 1, `ticks: ${a.sent}+${b.sent}`)

// 4. A Gmail refusal is recorded as FAILED, not retried automatically. Invalid address: nothing is delivered to anyone.
const bad = await createDelivery(s.id, TEST_USER, { recipientEmail: 'not-an-address', subject: 'should fail', message: 'x', sendAt: null, timezone: 'UTC', idempotencyKey: `it-bad-${run}` })
ok('Gmail failure is recorded as FAILED with the reason', bad.status === 'FAILED' && !!bad.lastError, bad.lastError?.slice(0, 120) ?? '')

// 5. Revoked link: scheduled email refuses to send.
const s2 = await createDelivery(s.id, TEST_USER, { recipientEmail: testAddress, subject: 'should not send', message: 'x', sendAt: new Date(Date.now() + 1000), timezone: 'UTC', idempotencyKey: `it-rev-${run}` })
await db.surprise.update({ where: { id: s.id }, data: { linkRevokedAt: new Date() } })
await new Promise((r) => setTimeout(r, 1500))
await processDueDeliveries()
const rev = (await db.delivery.findUnique({ where: { id: s2.id } }))!
ok('scheduled email for a revoked link is not sent', rev.status === 'FAILED' && /revoked/.test(rev.lastError ?? ''))

await db.surprise.delete({ where: { id: s.id } })
await db.integrationConnection.deleteMany({ where: { userId: TEST_USER } })
await db.$disconnect()
