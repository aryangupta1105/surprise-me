import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '@/lib/db'
import { StoredContent } from '@/lib/schemas'
import { cardsOutput, makeSurprise, makeUser } from './fixtures'

const send = vi.fn()
vi.mock('@/lib/viasocket', () => ({ viasocket: () => ({ user: () => ({ ai: { send } }) }) }))
const { assembleDoc, composeDraft, extractBrief, briefToInput } = await import('@/server/quick')
const { publish, openByToken, saveDraftDoc, draftDoc } = await import('@/server/surprises')

const quiz = { title: 'Quiz time', subtitle: 's', intro: 'i', palette: 'lagoon', closing: { title: 'End', message: 'AI closing' }, questions: Array(4).fill({ question: 'q', options: ['a', 'b', 'c', 'd'], correctIndex: 1, reveal: 'r' }), results: { high: 'h', medium: 'm', low: 'l' } }
beforeEach(() => send.mockReset())

describe('assembleDoc', () => {
  const contents = [StoredContent.parse({ ...cardsOutput, type: 'cards' }), StoredContent.parse({ ...quiz, type: 'quiz' })]
  it('builds opening, photos, one scene per experience and a finale', () => {
    const doc = assembleDoc(contents, { photoIds: ['p1', 'p2'], personalMessage: '', creatorName: 'Rohan' })
    expect(doc.scenes.map((s) => s.kind)).toEqual(['opening', 'media', 'game', 'game', 'finale'])
    expect(doc.scenes[2].blocks[0].type).toBe('cards')
    expect(doc.scenes[3].blocks[0].type).toBe('quiz')
    expect(doc.scenes[1].blocks[1].props.items).toHaveLength(2)
    expect(doc.scenes.at(-1)!.blocks.find((b) => b.type === 'letter')!.props.body).toBe('AI closing')
  })
  it('keeps the creator’s own message word for word and skips the photo scene without photos', () => {
    const doc = assembleDoc(contents, { photoIds: [], personalMessage: 'My exact words.', creatorName: 'Rohan' })
    expect(doc.scenes.some((s) => s.kind === 'media')).toBe(false)
    const letter = doc.scenes.at(-1)!.blocks.find((b) => b.type === 'letter')!
    expect([letter.props.body, letter.props.signoff]).toEqual(['My exact words.', '— Rohan'])
  })
})

describe('extractBrief', () => {
  it('returns a validated brief and maps it to studio input', async () => {
    const brief = { occasion: 'birthday', customOccasion: '', recipientName: 'Riya', creatorName: '', relationship: 'best friend', tone: 'mixed', language: 'English', personality: '', interests: 'music', loves: '', memories: [], insideJokes: [], importantDates: [], personalMessage: '', experiences: ['cards'], wantsPhotos: true, wantsVoice: false, wantsVideo: false, palette: 'sunrise' }
    send.mockResolvedValue({ content: brief, finishReason: 'completed' })
    const b = await extractBrief('u', 'A birthday surprise for Riya who loves music')
    expect(b.recipientName).toBe('Riya')
    expect(send.mock.calls[0][0].message).toMatch(/<description>/)
    expect(briefToInput({ ...b, creatorName: 'Me' }).experienceType).toBe('cards')
  })
  it('turns a malformed answer into a clear error', async () => {
    send.mockResolvedValue({ content: { occasion: 'wedding' }, finishReason: 'completed' })
    await expect(extractBrief('u', 'something long enough here')).rejects.toMatchObject({ status: 502, code: 'extract_failed' })
  })
})

describe('composeDraft', () => {
  it('writes each experience, attaches only this surprise’s photos and saves a draft version', async () => {
    const u = await makeUser()
    const other = await makeUser()
    const s = await makeSurprise(u.id)
    const mine = await db.upload.create({ data: { ownerId: u.id, surpriseId: s.id, mime: 'image/png', size: 1, data: new Uint8Array([1]) } })
    const otherS = await makeSurprise(other.id)
    const theirs = await db.upload.create({ data: { ownerId: other.id, surpriseId: otherS.id, mime: 'image/png', size: 1, data: new Uint8Array([1]) } })
    send.mockImplementation(async (p?: { jsonSchema?: { name: string } }) => ({ content: p?.jsonSchema?.name === 'quiz' ? quiz : cardsOutput, finishReason: 'completed' }))
    const doc = await composeDraft(s.id, u.id, { experiences: ['cards', 'quiz'], photoIds: [mine.id, theirs.id], palette: 'midnight' })
    expect(send).toHaveBeenCalledTimes(2)
    expect(doc.theme.palette).toBe('midnight')
    const gallery = doc.scenes.find((x) => x.kind === 'media')!.blocks[1].props.items as { photoId: string }[]
    expect(gallery.map((g) => g.photoId)).toEqual([mine.id])
    const row = await db.surprise.findUniqueOrThrow({ where: { id: s.id } })
    expect([row.generationStatus, row.title, Boolean(row.draftVersionId)]).toEqual(['SUCCEEDED', 'For Maya', true])
    expect((await draftDoc(row)).scenes).toHaveLength(doc.scenes.length)
  })

  it('records a failure when an experience cannot be written', async () => {
    const u = await makeUser()
    const s = await makeSurprise(u.id)
    send.mockResolvedValue({ content: { nope: true }, finishReason: 'completed' })
    await expect(composeDraft(s.id, u.id, { experiences: ['cards'], photoIds: [] })).rejects.toMatchObject({ status: 502 })
    expect((await db.surprise.findUniqueOrThrow({ where: { id: s.id } })).generationStatus).toBe('FAILED')
  })
})

describe('draft documents', () => {
  it('refuses invalid documents, prunes old drafts, and publishing freezes the draft', async () => {
    const u = await makeUser()
    const s = await makeSurprise(u.id)
    const doc = assembleDoc([StoredContent.parse({ ...cardsOutput, type: 'cards' })], { photoIds: [], personalMessage: '', creatorName: 'R' })
    await expect(saveDraftDoc(s.id, u.id, { ...doc, scenes: [] }, 'manual')).rejects.toThrow()
    for (let i = 0; i < 32; i++) await saveDraftDoc(s.id, u.id, { ...doc, scenes: [{ ...doc.scenes[0], title: `v${i}` }, ...doc.scenes.slice(1)] }, 'autosave')
    expect(await db.surpriseVersion.count({ where: { surpriseId: s.id } })).toBe(30)
    const t = (await publish(s.id, u.id)).url.split('/s/')[1]
    expect((await openByToken(t))?.doc.scenes[0].title).toBe('v31')
    await saveDraftDoc(s.id, u.id, { ...doc, scenes: [{ ...doc.scenes[0], title: 'later' }, ...doc.scenes.slice(1)] }, 'manual')
    expect((await openByToken(t))?.doc.scenes[0].title).toBe('v31') // still the published one
  })
})
