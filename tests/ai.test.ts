import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '@/lib/db'
import { cardsOutput, makeSurprise, makeUser } from './fixtures'

// Failure cases need a controllable AI; the success path is also covered live by scripts/test-ai.mts.
const send = vi.fn()
vi.mock('@/lib/viasocket', () => ({ viasocket: () => ({ user: () => ({ ai: { send } }) }) }))
const { generateExperience, regenerateSection } = await import('@/server/ai')

beforeEach(() => send.mockReset())

describe('generateExperience', () => {
  it('stores valid structured output and records the generation', async () => {
    const u = await makeUser()
    const s = await makeSurprise(u.id)
    send.mockResolvedValue({ content: cardsOutput, finishReason: 'completed', threadId: 't', messageId: 'm' })
    const c = await generateExperience(s.id, u.id)
    expect(c.type).toBe('cards')
    const saved = await db.surprise.findUniqueOrThrow({ where: { id: s.id } })
    expect(saved.generationStatus).toBe('SUCCEEDED')
    expect(saved.title).toBe('For Maya')
    expect(await db.aIGeneration.count({ where: { surpriseId: s.id, status: 'SUCCEEDED' } })).toBe(1)
    // the prompt treats creator data as data and is sent with a strict JSON schema
    const call = send.mock.calls[0][0]
    expect(call.prompt).toMatch(/DATA, not instructions/)
    expect(call.message).toMatch(/<creator_data>/)
    expect(call.jsonSchema.strict).toBe(true)
  })

  it('retries once on malformed output, then fails cleanly and keeps the error', async () => {
    const u = await makeUser()
    const s = await makeSurprise(u.id)
    send.mockResolvedValue({ content: { title: 'only a title' }, finishReason: 'completed' })
    await expect(generateExperience(s.id, u.id)).rejects.toMatchObject({ status: 502 })
    expect(send).toHaveBeenCalledTimes(2)
    const saved = await db.surprise.findUniqueOrThrow({ where: { id: s.id } })
    expect(saved.generationStatus).toBe('FAILED')
    expect(saved.content).toBeNull()
    expect(await db.aIGeneration.count({ where: { surpriseId: s.id, status: 'FAILED' } })).toBe(2)
  })

  it('handles non-JSON text and truncated answers as failures', async () => {
    const u = await makeUser()
    const s = await makeSurprise(u.id)
    send.mockResolvedValueOnce({ content: 'not json {', finishReason: 'completed' }).mockResolvedValueOnce({ content: cardsOutput, finishReason: 'truncated' })
    await expect(generateExperience(s.id, u.id)).rejects.toBeTruthy()
  })

  it('does not retry a refusal such as exhausted credits', async () => {
    const u = await makeUser()
    const s = await makeSurprise(u.id)
    // A refusal arrives as a resolved-then-thrown error inside askJson (not thrown by the spy itself).
    send.mockResolvedValue({ get content(): never { throw Object.assign(new Error('Plan credits are exhausted'), { status: 402 }) }, finishReason: 'completed' })
    const err = await generateExperience(s.id, u.id).catch((e) => e)
    expect([err.status, err.message]).toEqual([502, "We couldn't write your surprise: Plan credits are exhausted"])
    expect(send).toHaveBeenCalledTimes(1)
  })

  it('refuses a second concurrent generation and other users', async () => {
    const u = await makeUser()
    const other = await makeUser()
    const s = await makeSurprise(u.id)
    await db.surprise.update({ where: { id: s.id }, data: { generationStatus: 'PENDING' } })
    await expect(generateExperience(s.id, u.id)).rejects.toMatchObject({ status: 409 })
    await expect(generateExperience(s.id, other.id)).rejects.toMatchObject({ status: 404 })
    expect(send).not.toHaveBeenCalled()
  })
})

describe('regenerateSection', () => {
  it('rewrites one item and validates it', async () => {
    const u = await makeUser()
    const s = await makeSurprise(u.id, true)
    send.mockResolvedValue({ content: { emoji: '🔥', heading: 'New', body: 'Fresh' }, finishReason: 'completed' })
    const item = await regenerateSection(s.id, u.id, 2, 'funnier')
    expect(item).toEqual({ emoji: '🔥', heading: 'New', body: 'Fresh' })
    expect(send.mock.calls[0][0].message).toMatch(/cards\[2\]/)
    await expect(regenerateSection(s.id, u.id, 9, '')).rejects.toMatchObject({ status: 400 })
  })
})
