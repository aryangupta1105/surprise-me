import { describe, expect, it } from 'vitest'
import { composeTemplates, insertTemplate, instantiate, missingMedia } from '@/engine/compose'
import { parseDoc } from '@/engine/doc'
import { TEMPLATES } from '@/templates/library'

const names = { to: 'Maya "M" O’Neil', from: 'Rohan' }

describe('template library', () => {
  it.each(TEMPLATES.map((t) => [t.id, t]))('%s is a valid document with one opening and one finale', (_, t) => {
    const doc = parseDoc({ version: 1, theme: { palette: t.palette, motion: t.motion }, scenes: instantiate(t, names) })
    expect(doc.scenes.filter((s) => s.kind === 'opening')).toHaveLength(1)
    expect(doc.scenes.filter((s) => s.kind === 'finale')).toHaveLength(1)
    expect(JSON.stringify(doc)).not.toMatch(/\{to\}|\{from\}/)
  })
  it('has unique ids and names; names with quotes survive substitution', () => {
    expect(new Set(TEMPLATES.map((t) => t.id)).size).toBe(TEMPLATES.length)
    const s = instantiate(TEMPLATES[0], names)
    expect(s[0].blocks[0].props.text).toBe('Happy birthday, Maya "M" O’Neil! 🎉')
  })
})

describe('composeTemplates', () => {
  const ids = ['birthday-celebration', 'friendship-scrapbook', 'our-soundtrack', 'open-when-letters']
  it('merges scene structures: one opening, one finale, all content in order', () => {
    const { doc, skipped } = composeTemplates(ids, names)
    const kinds = doc.scenes.map((s) => s.kind)
    expect(kinds[0]).toBe('opening')
    expect(kinds.at(-1)).toBe('finale')
    expect(kinds.filter((k) => k === 'opening')).toHaveLength(1)
    expect(kinds.filter((k) => k === 'finale')).toHaveLength(1)
    expect(doc.scenes.map((s) => s.title)).toEqual(['Opening', 'Your year in photos', 'Birthday wishes', 'Exhibit A: photos', 'Inside jokes', 'Why you’re my person', 'Track 1', 'Track 2', 'Track 3', 'The letters', 'Finale'])
    expect(skipped).toHaveLength(6) // 3 openings + 3 finales
    // content preserved verbatim
    expect(doc.scenes[2].blocks[0].props.cards).toEqual(TEMPLATES[0].scenes[2].blocks[0].props.cards)
    // every id is fresh and unique
    const all = doc.scenes.flatMap((s) => [s.id, ...s.blocks.map((b) => b.id)])
    expect(new Set(all).size).toBe(all.length)
  })
  it('lets the creator pick the opening, finale and overall theme', () => {
    const { doc } = composeTemplates(ids, { ...names, openingFrom: 'friendship-scrapbook', finaleFrom: 'our-soundtrack', palette: 'lagoon' })
    expect(doc.scenes[0].blocks[0].props.text).toBe('The Maya "M" O’Neil & Rohan scrapbook')
    expect(doc.scenes.at(-1)!.blocks.some((b) => b.type === 'audio')).toBe(true)
    expect(doc.theme.palette).toBe('lagoon')
    expect(doc.scenes.every((s) => !s.palette)).toBe(true)
  })
  it('keeps template colours only when compatible with the overall theme', () => {
    const { doc } = composeTemplates(['birthday-celebration', 'our-soundtrack', 'friendship-scrapbook'], { ...names, keepTemplateColours: true })
    expect(doc.theme.palette).toBe('sunrise')
    const palettes = new Set(doc.scenes.map((s) => s.palette))
    expect(palettes.has('midnight')).toBe(false) // dark soundtrack scenes take the light overall theme
    expect(palettes.has('candy')).toBe(true) // light scrapbook keeps its own colours
  })
  it('softens transitions when motion is not full', () => {
    const { doc } = composeTemplates(['mystery-treasure-hunt'], { ...names, motion: 'gentle' })
    expect(doc.scenes.map((s) => s.transition)).toEqual(['fade', 'fade', 'fade'])
  })
  it('refuses unknown templates and too many scenes', () => {
    expect(() => composeTemplates(['nope'], names)).toThrow(/Unknown template/)
    expect(() => composeTemplates([], names)).toThrow(/at least one/)
    const big = { ...names }
    const doc = composeTemplates(TEMPLATES.map((t) => t.id), big).doc
    expect(doc.scenes.length).toBeLessThanOrEqual(30)
  })
  it('lists missing media', () => {
    const { doc } = composeTemplates(['birthday-celebration', 'our-soundtrack'], names)
    const m = missingMedia(doc)
    expect(m.filter((x) => x.kind === 'image')).toHaveLength(6)
    expect(m.filter((x) => x.kind === 'audio')).toHaveLength(3) // the soundtrack's finale (voice note) gives way to the birthday finale
  })
})

describe('insertTemplate', () => {
  const base = composeTemplates(['birthday-celebration'], names).doc
  it('inserts content scenes before the finale and skips the duplicate opening/finale', () => {
    const { doc, skipped } = insertTemplate(base, 'open-when-letters', 99, names)
    expect(doc.scenes.map((s) => s.title)).toEqual(['Opening', 'Your year in photos', 'Birthday wishes', 'The letters', 'Finale'])
    expect(skipped.map((s) => s.scene)).toEqual(['Opening', 'Finale'])
    expect(doc.theme).toEqual(base.theme)
  })
  it('inserts at a chosen position', () => {
    const { doc } = insertTemplate(base, 'friendship-quiz', 1, names)
    expect(doc.scenes[1].title).toBe('The quiz')
  })
  it('adds an opening/finale when the document has none', () => {
    const bare = parseDoc({ ...base, scenes: [base.scenes[1]] })
    const { doc } = insertTemplate(bare, 'friendship-quiz', 0, names)
    expect(doc.scenes.map((s) => s.kind)).toEqual(['opening', 'game', 'media', 'finale'])
  })
})
