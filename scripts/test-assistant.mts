// Live test of the AI assistant (viaSocket AI, uses real credits). Run once:
// node --env-file=.env --conditions=react-server --import tsx scripts/test-assistant.mts
import { db } from '../src/lib/db.ts'
import { composeTemplates } from '../src/engine/compose.ts'
import { runAssistant } from '../src/server/assistant.ts'

const { doc } = composeTemplates(['birthday-celebration', 'friendship-scrapbook'], { to: 'Maya', from: 'Rohan' })
const user = await db.user.create({ data: { isGuest: true } })
const s = await db.surprise.create({ data: { ownerId: user.id, occasion: 'birthday', recipientName: 'Maya', creatorName: 'Rohan', input: {} } })
try {
  const t0 = Date.now()
  const r = await runAssistant(s.id, user.id, doc, 'make the opening funnier and add a scene thanking them for always showing up')
  console.log(`${Date.now() - t0}ms\nsummary: ${r.summary}\nchanges:\n- ${r.changes.join('\n- ')}\nskipped: ${JSON.stringify(r.skipped)}`)
  console.log('before:', doc.scenes.map((x) => x.title).join(' | '))
  console.log('after: ', r.doc.scenes.map((x) => x.title).join(' | '))
  console.log('opening:', JSON.stringify(r.doc.scenes[0].blocks.map((b) => b.props)))
  const added = r.doc.scenes.find((x) => !doc.scenes.some((y) => y.id === x.id))
  if (added) console.log('new scene:', JSON.stringify(added))
} finally {
  await db.surprise.delete({ where: { id: s.id } })
  await db.user.delete({ where: { id: user.id } })
}
