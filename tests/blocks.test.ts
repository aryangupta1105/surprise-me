import { describe, expect, it } from 'vitest'
import { BLOCKS, isInteractive } from '@/engine/blocks'

const NEW = ['countdown', 'scratch_reveal', 'memory_match', 'awards', 'journey', 'magazine_cover'] as const
const ok = (t: keyof typeof BLOCKS, v: unknown) => BLOCKS[t].schema.safeParse(v).success
const pairs = (n: number) => Array.from({ length: n }, (_, i) => ({ emoji: '⭐', label: `P${i}` }))
const stops = (n: number) => Array.from({ length: n }, (_, i) => ({ place: `Stop ${i}` }))
const awards = (n: number) => Array.from({ length: n }, (_, i) => ({ award: `Award ${i}` }))

describe('new blocks', () => {
  it.each(NEW)('%s create() passes its schema', (t) => expect(ok(t, BLOCKS[t].create())).toBe(true))

  it('marks only the games as interactive', () => {
    expect(NEW.filter(isInteractive)).toEqual(['scratch_reveal', 'memory_match'])
  })

  it('countdown needs an ISO datetime and fills defaults', () => {
    expect(ok('countdown', { target: 'next friday' })).toBe(false)
    expect(BLOCKS.countdown.schema.parse({ target: '2027-01-01T00:00:00.000Z' })).toEqual({ target: '2027-01-01T00:00:00.000Z', title: '', doneMessage: '' })
  })

  it('scratch_reveal needs hidden text; photo is optional', () => {
    expect(ok('scratch_reveal', {})).toBe(false)
    expect(BLOCKS.scratch_reveal.schema.parse({ hiddenText: 'hi' })).toEqual({ hiddenText: 'hi', prompt: 'Scratch to reveal' })
    expect(ok('scratch_reveal', { hiddenText: 'x'.repeat(501) })).toBe(false)
  })

  it('memory_match takes 3 to 8 pairs with an emoji each', () => {
    expect(ok('memory_match', { pairs: pairs(2) })).toBe(false)
    expect(ok('memory_match', { pairs: pairs(3) })).toBe(true)
    expect(ok('memory_match', { pairs: pairs(8) })).toBe(true)
    expect(ok('memory_match', { pairs: pairs(9) })).toBe(false)
    expect(ok('memory_match', { pairs: [...pairs(2), { emoji: '', label: 'x' }] })).toBe(false)
  })

  it('awards take 1 to 10 awards with emoji/reason defaults', () => {
    expect(ok('awards', { awards: [] })).toBe(false)
    expect(ok('awards', { awards: awards(11) })).toBe(false)
    expect(BLOCKS.awards.schema.parse({ awards: awards(1) }).awards[0]).toEqual({ award: 'Award 0', emoji: '🏆', reason: '' })
  })

  it('journey takes 2 to 12 stops', () => {
    expect(ok('journey', { stops: stops(1) })).toBe(false)
    expect(ok('journey', { stops: stops(12) })).toBe(true)
    expect(ok('journey', { stops: stops(13) })).toBe(false)
    expect(BLOCKS.journey.schema.parse({ stops: stops(2) }).stops[0]).toEqual({ place: 'Stop 0', emoji: '📍', dateLabel: '', note: '' })
  })

  it('magazine_cover allows at most 5 cover lines', () => {
    const base = { masthead: 'ICON', headline: 'H' }
    expect(BLOCKS.magazine_cover.schema.parse(base)).toEqual({ ...base, issue: '', coverLines: [] })
    expect(ok('magazine_cover', { ...base, coverLines: Array(6).fill('line') })).toBe(false)
    expect(ok('magazine_cover', { headline: 'H' })).toBe(false)
  })
})
