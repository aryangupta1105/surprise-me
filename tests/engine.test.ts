import { describe, expect, it } from 'vitest'
import { BLOCK_TYPES, BLOCKS } from '@/engine/blocks'
import { legacyToDoc } from '@/engine/convert'
import { SurpriseDoc, parseDoc, type SurpriseDoc as Doc } from '@/engine/doc'
import * as ops from '@/engine/ops'
import { StoredContent } from '@/lib/schemas'

const base = { title: 'T', subtitle: 'S', intro: 'I', palette: 'lagoon', closing: { title: 'Bye', message: 'Love' } }
const LEGACY = {
  treasure_hunt: { clues: [1, 2, 3].map(() => ({ riddle: 'r', answer: 'a', acceptedAnswers: [], hint: 'h', successMessage: 's' })) },
  memory_journey: { moments: [{ heading: 'h', dateLabel: '', story: 's', emoji: '✨' }, { heading: 'h2', dateLabel: '2020', story: 's', emoji: '🌊', photoId: 'p1' }] },
  quiz: { questions: Array(4).fill({ question: 'q', options: ['a', 'b', 'c', 'd'], correctIndex: 2, reveal: 'r' }), results: { high: 'h', medium: 'm', low: 'l' } },
  gift_reveal: { anticipation: ['a', 'b'], stages: [{ label: 'l', message: 'm' }, { label: 'l2', message: 'm2' }], gift: { title: 'g', message: 'm' }, giftPhotoId: 'p2' },
  cards: { deckTitle: 'd', cards: Array(5).fill({ emoji: '⭐', heading: 'h', body: 'b' }) },
  open_when: { letters: [{ when: 'w', emoji: '💌', letter: 'l' }] },
}

const fresh = (): Doc => legacyToDoc(StoredContent.parse({ ...base, ...LEGACY.cards, type: 'cards' }))

describe('legacy → scene document', () => {
  it.each(Object.entries(LEGACY))('converts %s into a valid opening/experience/finale document', (type, extra) => {
    const doc = legacyToDoc(StoredContent.parse({ ...base, ...extra, type }), { palette: 'midnight', motion: 'gentle' })
    expect(SurpriseDoc.safeParse(doc).success).toBe(true)
    expect(doc.scenes.map((s) => s.kind)).toEqual(['opening', 'game', 'finale'])
    expect(doc.theme).toEqual({ palette: 'midnight', motion: 'gentle' })
    expect(doc.scenes[0].blocks[0].props.text).toBe('T')
    expect(doc.scenes[2].blocks.find((b) => b.type === 'letter')?.props.body).toBe('Love')
  })
  it('keeps creator photos on converted blocks', () => {
    const doc = legacyToDoc(StoredContent.parse({ ...base, ...LEGACY.gift_reveal, type: 'gift_reveal' }))
    expect(doc.scenes[1].blocks[0].props.giftPhotoId).toBe('p2')
  })
})

describe('block registry', () => {
  it('every block type creates valid default props', () => {
    for (const t of BLOCK_TYPES) expect(BLOCKS[t].schema.safeParse(BLOCKS[t].create()).success, t).toBe(true)
  })
  it('rejects unknown block types and invalid props', () => {
    const doc = fresh()
    expect(SurpriseDoc.safeParse({ ...doc, scenes: [{ ...doc.scenes[0], blocks: [{ id: 'x', type: 'script', props: {} }] }] }).success).toBe(false)
    expect(SurpriseDoc.safeParse({ ...doc, scenes: [{ ...doc.scenes[0], blocks: [{ id: 'x', type: 'quiz', props: { questions: [] } }] }] }).success).toBe(false)
  })
  it('parseDoc applies block defaults', () => {
    const doc = parseDoc({ version: 1, theme: { palette: 'candy' }, scenes: [{ id: 's', kind: 'content', blocks: [{ id: 'b', type: 'heading', props: { text: 'Hi' } }] }] })
    expect(doc.scenes[0].blocks[0].props).toEqual({ text: 'Hi', size: 'xl', kicker: '' })
    expect(doc.scenes[0].transition).toBe('fade')
  })
})

describe('document operations', () => {
  it('adds, moves, duplicates and removes scenes with fresh ids', () => {
    let doc = fresh()
    doc = ops.addScene(doc, { kind: 'content', title: 'Photos', blocks: [ops.newBlock('gallery')] }, 1)
    expect(doc.scenes.map((s) => s.title)).toEqual(['Opening', 'Photos', 'The surprise', 'Finale'])
    const photosId = doc.scenes[1].id
    doc = ops.duplicateScene(doc, photosId)
    expect(doc.scenes[2].title).toBe('Photos')
    expect(doc.scenes[2].id).not.toBe(photosId)
    expect(doc.scenes[2].blocks[0].id).not.toBe(doc.scenes[1].blocks[0].id)
    doc = ops.moveScene(doc, photosId, 99)
    expect(doc.scenes.at(-1)?.id).toBe(photosId)
    doc = ops.removeScene(doc, photosId)
    expect(doc.scenes).toHaveLength(4)
  })
  it('edits blocks and refuses invalid results', () => {
    let doc = fresh()
    const sid = doc.scenes[0].id
    const bid = doc.scenes[0].blocks[0].id
    doc = ops.updateBlockProps(doc, sid, bid, { text: 'New title' })
    expect(doc.scenes[0].blocks[0].props.text).toBe('New title')
    doc = ops.duplicateBlock(doc, sid, bid)
    doc = ops.moveBlock(doc, sid, doc.scenes[0].blocks[1].id, 0)
    expect(doc.scenes[0].blocks).toHaveLength(4)
    expect(() => ops.updateBlockProps(doc, sid, bid, { size: 'gigantic' })).toThrow()
    expect(() => ops.removeScene(ops.removeScene(ops.removeScene(doc, 'opening'), 'main'), 'finale')).toThrow(/at least one scene/)
  })
  it('does not mutate its input', () => {
    const doc = fresh()
    const before = JSON.stringify(doc)
    ops.setTheme(doc, { palette: 'meadow' })
    ops.addBlock(doc, doc.scenes[0].id, ops.newBlock('quote'))
    expect(JSON.stringify(doc)).toBe(before)
  })
})
