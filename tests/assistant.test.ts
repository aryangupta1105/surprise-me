import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '@/lib/db'
import { composeTemplates } from '@/engine/compose'
import { parseDoc, type SurpriseDoc } from '@/engine/doc'
import { makeSurprise, makeUser } from './fixtures'

const send = vi.fn()
vi.mock('@/lib/viasocket', () => ({ viasocket: () => ({ user: () => ({ ai: { send } }) }) }))
const { runAssistant, rewriteBlock, AssistantReply } = await import('@/server/assistant')
const { z } = await import('zod')
const { modelSchema } = await import('@/server/ai')

beforeEach(() => send.mockReset())
const reply = (content: unknown) => send.mockResolvedValue({ content, finishReason: 'completed' })
const base = () => composeTemplates(['birthday-celebration'], { to: 'Maya', from: 'Rohan' }).doc

/** A doc with one image that already has a photo, so media-keeping can be checked. */
function withPhoto(doc: SurpriseDoc) {
  const s = doc.scenes.find((x) => x.blocks.some((b) => b.type === 'image' || b.type === 'gallery'))!
  const b = s.blocks.find((x) => x.type === 'image' || x.type === 'gallery')!
  if (b.type === 'image') b.props.photoId = 'photo-real'
  else (b.props.items as { photoId?: string }[])[0].photoId = 'photo-real'
  return { doc: parseDoc(doc), scene: s, block: b }
}

describe('assistant operations', async () => {
  const u = await makeUser()
  const s = await makeSurprise(u.id)

  it('applies valid operations in order and describes them', async () => {
    const doc = base()
    const opening = doc.scenes[0]
    const heading = opening.blocks.find((b) => b.type === 'heading')!
    reply({
      summary: 'Funnier opening and a thank-you scene.',
      operations: [
        { op: 'update_block', sceneId: opening.id, blockId: heading.id, props: JSON.stringify({ text: 'Happy birthday, you magnificent goose!' }) },
        { op: 'add_scene', kind: 'content', title: 'Thank you', blocks: [{ type: 'paragraph', props: JSON.stringify({ text: 'For always showing up at [add the place].' }) }] },
        { op: 'set_theme', palette: 'midnight' },
      ],
    })
    const r = await runAssistant(s.id, u.id, doc, 'make the opening funnier and add a thank-you scene')
    expect(r.skipped).toEqual([])
    expect(r.changes).toEqual(['Updated the heading in “Opening”', 'Added the scene “Thank you”', 'Changed the palette of the whole surprise'])
    expect(r.doc.scenes[0].blocks.find((b) => b.id === heading.id)!.props).toMatchObject({ text: 'Happy birthday, you magnificent goose!', size: heading.props.size })
    expect(r.doc.scenes.at(-2)!.title).toBe('Thank you') // goes just before the finale
    expect(r.doc.scenes.at(-1)!.kind).toBe('finale')
    expect(r.doc.theme.palette).toBe('midnight')
    const log = await db.aIGeneration.findFirstOrThrow({ where: { surpriseId: s.id, section: 'assistant' }, orderBy: { createdAt: 'desc' } })
    expect(log.status).toBe('SUCCEEDED')
    // the prompt wraps the creator's data and lists the block schemas
    expect(send.mock.calls[0][0].message).toMatch(/<creator_instruction>make the opening/)
    expect(send.mock.calls[0][0].prompt).toMatch(/- heading \(Heading\)/)
  })

  it('skips an operation that fails, with a reason, and still applies the rest', async () => {
    const doc = base()
    const opening = doc.scenes[0]
    const heading = opening.blocks.find((b) => b.type === 'heading')!
    reply({
      summary: 's',
      operations: [
        { op: 'remove_scene', sceneId: 'nope' },
        { op: 'update_block', sceneId: opening.id, blockId: heading.id, props: JSON.stringify({ size: 'gigantic' }) },
        { op: 'update_block', sceneId: opening.id, blockId: heading.id, props: 'not json' },
        { op: 'update_scene', sceneId: opening.id, title: 'Hello!' },
      ],
    })
    const r = await runAssistant(s.id, u.id, doc, 'tidy things up please')
    expect(r.skipped.map((x) => x.reason)).toEqual(['there is no scene nope', expect.stringMatching(/^invalid size/), 'props were not valid JSON'])
    expect(r.changes).toEqual(['Renamed “Opening” to “Hello!”'])
    expect(r.doc.scenes.length).toBe(doc.scenes.length)
  })

  it('strips media ids the AI invented but keeps existing ones', async () => {
    const { doc, scene } = withPhoto(base())
    reply({
      summary: 's',
      operations: [
        { op: 'add_block', sceneId: scene.id, type: 'image', props: JSON.stringify({ photoId: 'invented', caption: 'new' }) },
        { op: 'add_block', sceneId: scene.id, type: 'image', props: JSON.stringify({ photoId: 'photo-real', caption: 'again' }) },
      ],
    })
    const r = await runAssistant(s.id, u.id, doc, 'add two photos')
    const added = r.doc.scenes.find((x) => x.id === scene.id)!.blocks.slice(-2)
    expect(added.map((b) => b.props.photoId)).toEqual([undefined, 'photo-real'])
    expect(JSON.stringify(r.doc)).not.toMatch(/invented/)
  })

  it('is only for the owner', async () => {
    const other = await makeUser()
    await expect(runAssistant(s.id, other.id, base(), 'make it funnier')).rejects.toMatchObject({ status: 404 })
    await expect(runAssistant(s.id, u.id, { version: 1 }, 'make it funnier')).rejects.toMatchObject({ status: 400 })
    expect(send).not.toHaveBeenCalled()
  })

  it('turns malformed AI output into a clean 502 and logs the failure', async () => {
    reply({ summary: 'x', operations: [{ op: 'explode' }] })
    await expect(runAssistant(s.id, u.id, base(), 'make it funnier')).rejects.toMatchObject({ status: 502, code: 'assistant_failed' })
    expect(send).toHaveBeenCalledTimes(2) // one retry
    const fails = await db.aIGeneration.count({ where: { surpriseId: s.id, section: 'assistant', status: 'FAILED' } })
    expect(fails).toBeGreaterThanOrEqual(2)
  })

  it('does not retry a refusal', async () => {
    // thrown from a getter, as in ai.test.ts: a rejecting mock trips vitest's unhandled-error check
    send.mockResolvedValue({ get content(): never { throw Object.assign(new Error('no credits'), { status: 402 }) }, finishReason: 'completed' })
    await expect(runAssistant(s.id, u.id, base(), 'make it funnier')).rejects.toMatchObject({ status: 502 })
    expect(send).toHaveBeenCalledTimes(1)
  })

  it('sends a model schema without anyOf-hostile constructs', () => {
    const json = JSON.stringify(modelSchema(z.toJSONSchema(AssistantReply)))
    expect(json).not.toMatch(/oneOf|minItems|maxLength/)
  })
})

describe('block rewrite', async () => {
  const u = await makeUser()
  const s = await makeSurprise(u.id)

  it('replaces the block props and keeps its media ids', async () => {
    const { doc, scene, block } = withPhoto(base())
    const fresh = block.type === 'image'
      ? { photoId: 'invented', caption: 'A fresh caption', alt: 'alt' }
      : { layout: 'grid', items: (block.props.items as unknown[]).map((_, i) => ({ photoId: 'invented', caption: `Fresh ${i}`, alt: '' })) }
    reply(fresh)
    const r = await rewriteBlock(s.id, u.id, doc, scene.id, block.id, 'shorter')
    const b = r.doc.scenes.find((x) => x.id === scene.id)!.blocks.find((x) => x.id === block.id)!
    expect(JSON.stringify(b.props)).not.toMatch(/invented/)
    if (block.type === 'image') expect(b.props).toMatchObject({ photoId: 'photo-real', caption: 'A fresh caption' })
    else expect((b.props.items as { photoId?: string; caption: string }[])[0]).toMatchObject({ photoId: 'photo-real', caption: 'Fresh 0' })
    expect(send.mock.calls[0][0].message).toMatch(/<creator_note>shorter<\/creator_note>/)
  })

  it('refuses unknown blocks and other owners', async () => {
    const doc = base()
    await expect(rewriteBlock(s.id, u.id, doc, doc.scenes[0].id, 'nope', '')).rejects.toMatchObject({ status: 404 })
    const other = await makeUser()
    await expect(rewriteBlock(s.id, other.id, doc, doc.scenes[0].id, doc.scenes[0].blocks[0].id, '')).rejects.toMatchObject({ status: 404 })
  })
})
