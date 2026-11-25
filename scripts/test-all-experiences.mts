// Live AI test: generates each experience type through the app's real generateExperience (viaSocket AI + Zod).
// Run: node --env-file=.env --conditions=react-server --import tsx scripts/test-all-experiences.mts [type...]
import { db } from '../src/lib/db.ts'
import { generateExperience } from '../src/server/ai.ts'
import { EXPERIENCES } from '../src/lib/schemas.ts'

const USER = 'apps-api-test-user'
await db.user.upsert({ where: { id: USER }, create: { id: USER }, update: {} })
const input = {
  occasion: 'anniversary', customOccasion: '', recipientName: 'Sam', creatorName: 'Alex', relationship: 'partner of 4 years', personality: 'calm, nerdy, terrible at mornings',
  interests: 'board games, baking sourdough, hiking', loves: 'our dog Biscuit, thunderstorms', language: 'English', tone: 'romantic',
  memories: ['First date at a tiny dumpling place in 2022 where we both ordered the same thing', 'Got caught in a thunderstorm on the Ridge trail and laughed the whole way down', 'Adopted Biscuit in March 2024'],
  insideJokes: ['"tactical nap"'], importantDates: ['Met on 14 May 2022'], specialPhrases: ['"you absolute gem"'], appreciation: 'How patient Sam is with me',
  personalMessage: 'Four years and I still get excited when I hear your keys in the door.', difficulty: 'medium',
}
const types = (process.argv.slice(2).length ? process.argv.slice(2) : EXPERIENCES) as (typeof EXPERIENCES)[number][]
for (const type of types) {
  const s = await db.surprise.create({ data: { ownerId: USER, occasion: 'anniversary', recipientName: 'Sam', creatorName: 'Alex', input: { ...input, experienceType: type } } })
  const t0 = Date.now()
  try {
    const c = await generateExperience(s.id, USER)
    const list = Object.values(c).find(Array.isArray) as unknown[]
    console.log(`PASS ${type} ${Date.now() - t0}ms items=${list?.length} title="${c.title}"`)
    console.log('   sample:', JSON.stringify(list?.[0]).slice(0, 220))
  } catch (e) {
    const gens = await db.aIGeneration.findMany({ where: { surpriseId: s.id } })
    console.log(`FAIL ${type} ${Date.now() - t0}ms ${(e as Error).message}`, gens.map((g) => g.error))
  }
  await db.surprise.delete({ where: { id: s.id } })
}
await db.$disconnect()
