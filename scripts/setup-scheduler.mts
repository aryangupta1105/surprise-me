// Creates (or updates) the viaSocket automation that drives scheduled email delivery:
// every 5 minutes it POSTs to APP_URL/api/cron/tick with the TICK_SECRET header.
// The flow belongs to a fixed system user of this product (one stable id), as viaSocket's AI/automation docs advise
// for work with no end user present. Run after each deploy (APP_URL must be the public URL):
//   node --env-file=.env --import tsx scripts/setup-scheduler.mts [--pause]
import { ViaSocket } from 'viasocket-apps'

const SYSTEM_USER = 'surpriseme-system'
const TITLE = 'SurpriseMe scheduled delivery tick'
const { APP_URL, TICK_SECRET } = process.env
if (!APP_URL || !TICK_SECRET) throw new Error('APP_URL and TICK_SECRET are required')

const vs = new ViaSocket({ orgId: process.env.VIASOCKET_ORG_ID!, projectId: process.env.VIASOCKET_PROJECT_ID!, secret: process.env.VIASOCKET_EMBED_SECRET! })
const user = vs.user(SYSTEM_USER)

const flows = (await user.listFlows()) as { id: string; title?: string; status?: string }[]
let scriptId = flows.find((f) => f.title === TITLE && f.status !== 'deleted')?.id
if (!scriptId) scriptId = (await user.createFlow({ title: TITLE, description: 'Sends due SurpriseMe emails every 5 minutes.' })).scriptId
console.log('flow', scriptId ? 'ready' : 'missing')
if (!process.argv.includes('--pause')) await user.setFlowStatus(scriptId, 1) // a paused flow can't be saved

await user.setTrigger(scriptId, { triggerType: 'cron', cronStatement: '*/5 * * * *', timezone: 'UTC' })
const code = `
const res = await axios.post(${JSON.stringify(`${APP_URL.replace(/\/$/, '')}/api/cron/tick`)}, {}, { headers: { 'x-cron-secret': ${JSON.stringify(TICK_SECRET)} }, timeout: 50000 })
console.log('### tick', JSON.stringify(res.data))
return res.data`
await user.saveSteps(scriptId, [{ stepname: 'tick', code, serviceActionFunctions: [] }])

const flow = (await user.readFlow(scriptId)) as { status?: string; trigger?: unknown; steps?: { stepname?: string; name?: string }[] }
console.log('status:', flow.status, '| trigger:', JSON.stringify(flow.trigger).slice(0, 160), '| steps:', flow.steps?.map((s) => s.stepname ?? s.name))

if (process.argv.includes('--pause')) {
  await user.setFlowStatus(scriptId, 2)
  console.log('paused (APP_URL is not public yet)')
}
