import { describe, expect, it } from 'vitest'
import { isCorrect } from '@/components/experiences/TreasureHunt'
import { emailHtml } from '@/lib/email'
import { AI_SCHEMAS, StoredContent, StudioInput } from '@/lib/schemas'
import { reminderDate } from '@/server/calendar'
import { modelSchema } from '@/server/ai'
import { z } from 'zod'

describe('treasure hunt answer matching', () => {
  const clue = { answer: 'Ramen', acceptedAnswers: ['ramen noodles'] }
  it('ignores case, spacing and punctuation', () => expect(isCorrect('  RAMEN! ', clue)).toBe(true))
  it('accepts listed variants', () => expect(isCorrect('Ramen Noodles', clue)).toBe(true))
  it('forgives one typo on longer answers', () => expect(isCorrect('bouldring', { answer: 'bouldering', acceptedAnswers: [] })).toBe(true))
  it('rejects wrong and empty answers', () => {
    expect(isCorrect('sushi', clue)).toBe(false)
    expect(isCorrect('', clue)).toBe(false)
    expect(isCorrect('lot', { answer: 'lost', acceptedAnswers: [] })).toBe(false) // short answers must be exact
  })
})

describe('calendar reminder date', () => {
  it('subtracts days across month and year boundaries', () => {
    expect(reminderDate('2027-01-02', 3)).toBe('30-12-2026')
    expect(reminderDate('2026-03-01', 1)).toBe('28-02-2026')
    expect(reminderDate('2026-12-25', 0)).toBe('25-12-2026')
  })
})

describe('AI schema handling', () => {
  it('strips provider-unsupported bounds but keeps shape and enums', () => {
    const s = modelSchema(z.toJSONSchema(AI_SCHEMAS.quiz)) as Record<string, unknown>
    const json = JSON.stringify(s)
    expect(json).not.toMatch(/minItems|maxItems|maxLength|\$schema/)
    expect(json).toMatch(/"enum":\["sunrise"/)
    expect((s.required as string[]).includes('questions')).toBe(true)
  })
  it('rejects malformed AI output', () => {
    expect(AI_SCHEMAS.quiz.safeParse({ title: 'x' }).success).toBe(false)
    const q = { question: 'q', options: ['a', 'b', 'c'], correctIndex: 0, reveal: 'r' } // only 3 options
    expect(AI_SCHEMAS.quiz.safeParse({ title: 't', subtitle: 's', intro: 'i', palette: 'candy', closing: { title: 'a', message: 'b' }, questions: Array(4).fill(q), results: { high: 'h', medium: 'm', low: 'l' } }).success).toBe(false)
  })
  it('rejects unknown palettes and experience types in stored content', () => {
    expect(StoredContent.safeParse({ type: 'hack', title: 't' }).success).toBe(false)
  })
})

describe('studio input validation', () => {
  it('requires names and trims input', () => {
    expect(StudioInput.safeParse({ occasion: 'birthday', recipientName: ' ', creatorName: 'a' }).success).toBe(false)
    expect(StudioInput.parse({ occasion: 'birthday', recipientName: ' Maya ', creatorName: 'R' }).recipientName).toBe('Maya')
  })
  it('caps list sizes', () => expect(StudioInput.safeParse({ occasion: 'birthday', recipientName: 'a', creatorName: 'b', memories: Array(11).fill('m') }).success).toBe(false))
})

describe('email html', () => {
  it('escapes creator text so it cannot inject HTML', () => {
    const html = emailHtml({ message: '<script>alert(1)</script>\n\nHi', url: 'https://x/s/abc"onmouseover=1', creatorName: '<b>R</b>', recipientName: 'M&M' })
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
    expect(html).toContain('M&amp;M')
    expect(html).not.toContain('"onmouseover')
  })
})
