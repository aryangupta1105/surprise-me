import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '@/lib/db'
import { jar } from './setup'
import { makeSurprise } from './fixtures'

const send = vi.fn()
vi.mock('@/lib/viasocket', () => ({ viasocket: () => ({ user: () => ({ ai: { send } }) }) }))
const { signUp, signIn, changePassword, verifyPassword, hashPassword } = await import('@/server/accounts')
const { ensureUser, currentUser, requireAccount } = await import('@/lib/session')
const { askJson, AI_DAILY } = await import('@/server/ai')
const { z } = await import('zod')

const email = () => `t${Math.random().toString(36).slice(2)}@example.com`
beforeEach(() => jar.clear())

describe('passwords', () => {
  it('hashes with a salt and verifies', async () => {
    const a = await hashPassword('correct horse')
    expect(a).not.toBe(await hashPassword('correct horse'))
    expect(await verifyPassword('correct horse', a)).toBe(true)
    expect(await verifyPassword('wrong', a)).toBe(false)
    expect(await verifyPassword('x', 'garbage')).toBe(false)
  })
})

describe('accounts', () => {
  it('sign-up turns the current guest into the account, keeping its surprises and rotating the cookie', async () => {
    const guest = await ensureUser()
    const s = await makeSurprise(guest.id)
    const before = [...jar.values()][0]
    const e = email()
    const u = await signUp({ email: e.toUpperCase(), password: 'longenough', name: 'Ria' })
    expect(u.id).toBe(guest.id)
    expect(u.email).toBe(e)
    expect(u.isGuest).toBe(false)
    expect([...jar.values()][0]).not.toBe(before)
    expect((await db.surprise.findUniqueOrThrow({ where: { id: s.id } })).ownerId).toBe(u.id)
    await expect(signUp({ email: e, password: 'longenough' })).rejects.toMatchObject({ status: 409 })
  })

  it('sign-in from another guest brings that guest’s work along; wrong password is refused generically', async () => {
    jar.clear()
    const e = email()
    const account = await signUp({ email: e, password: 'longenough' })
    jar.clear()
    const guest2 = await ensureUser()
    const s2 = await makeSurprise(guest2.id)
    await expect(signIn({ email: e, password: 'nope-nope' })).rejects.toMatchObject({ status: 401, code: 'bad_credentials' })
    await expect(signIn({ email: 'nobody@example.com', password: 'nope-nope' })).rejects.toMatchObject({ status: 401, code: 'bad_credentials' })
    await signIn({ email: e, password: 'longenough' })
    expect((await currentUser())?.id).toBe(account.id)
    expect((await db.surprise.findUniqueOrThrow({ where: { id: s2.id } })).ownerId).toBe(account.id)
  })

  it('changing the password signs out every other session', async () => {
    jar.clear()
    const u = await signUp({ email: email(), password: 'longenough' })
    await db.session.create({ data: { userId: u.id, tokenHash: 'other-device', expiresAt: new Date(Date.now() + 1e9) } })
    await expect(changePassword(u.id, 'wrong-one', 'newpassword')).rejects.toMatchObject({ status: 401 })
    await changePassword(u.id, 'longenough', 'newpassword')
    expect(await db.session.findFirst({ where: { tokenHash: 'other-device' } })).toBeNull()
    expect((await currentUser())?.id).toBe(u.id)
  })

  it('requireAccount refuses guests with a sign-up prompt code', async () => {
    jar.clear()
    await ensureUser()
    await expect(requireAccount('send it by email')).rejects.toMatchObject({ status: 403, code: 'account_required' })
  })
})

describe('daily AI allowance', () => {
  it('stops a guest at the guest limit with a sign-up prompt, before calling the AI', async () => {
    jar.clear()
    const g = await ensureUser()
    await db.aiUse.createMany({ data: Array.from({ length: AI_DAILY.guest }, () => ({ userId: g.id, kind: 'x' })) })
    send.mockReset()
    await expect(askJson(g.id, 't', 'p', 'm', z.object({ a: z.string() }), 'x')).rejects.toMatchObject({ status: 429, code: 'account_required' })
    expect(send).not.toHaveBeenCalled()
  })
  it('counts each call', async () => {
    jar.clear()
    const g = await ensureUser()
    send.mockResolvedValue({ content: { a: 'ok' } })
    await askJson(g.id, 't', 'p', 'm', z.object({ a: z.string() }), 'x')
    expect(await db.aiUse.count({ where: { userId: g.id } })).toBe(1)
  })
})
