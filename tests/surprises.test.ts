import { describe, expect, it, vi } from 'vitest'
import { db } from '@/lib/db'
import { sha256 } from '@/lib/crypto'
import { archive, duplicate, openByToken, publish, recordEngagement, remove, revokeLink, saveContent, shareUrl } from '@/server/surprises'
import { cardsOutput, makeSurprise, makeUser } from './fixtures'
import { jar } from './setup'

const tokenOf = (url: string) => url.split('/s/')[1]

describe('publishing and private links', () => {
  it('publishes with a high-entropy token stored only as a hash (+ ciphertext)', async () => {
    const u = await makeUser()
    const s = await makeSurprise(u.id, true)
    const { url } = await publish(s.id, u.id)
    const token = tokenOf(url)
    expect(token.length).toBeGreaterThanOrEqual(32)
    const row = await db.surprise.findUniqueOrThrow({ where: { id: s.id } })
    expect(row.linkTokenHash).toBe(sha256(token))
    expect(row.linkTokenEnc).not.toContain(token)
    const open = await openByToken(token)
    expect(open?.doc.scenes[0].blocks[0].props.text).toBe('For Maya')
    expect(open?.doc.scenes.map((s) => s.kind)).toEqual(['opening', 'game', 'finale'])
    expect(Object.keys(open!)).toEqual(['id', 'doc', 'recipientName', 'creatorName']) // no owner or inputs
  })

  it('refuses to publish without content, or for another user', async () => {
    const u = await makeUser()
    const other = await makeUser()
    const empty = await makeSurprise(u.id)
    await expect(publish(empty.id, u.id)).rejects.toMatchObject({ status: 400 })
    const s = await makeSurprise(u.id, true)
    await expect(publish(s.id, other.id)).rejects.toMatchObject({ status: 404 })
    await expect(saveContent(s.id, other.id, { ...cardsOutput, type: 'cards' } as never)).rejects.toMatchObject({ status: 404 })
  })

  it('revoking, rotating and expiry all close the link', async () => {
    const u = await makeUser()
    const s = await makeSurprise(u.id, true)
    const first = tokenOf((await publish(s.id, u.id)).url)
    expect(tokenOf((await publish(s.id, u.id)).url)).toBe(first) // republish keeps the link
    const second = tokenOf((await publish(s.id, u.id, { rotate: true })).url)
    expect(second).not.toBe(first)
    expect(await openByToken(first)).toBeNull()
    await revokeLink(s.id, u.id)
    expect(await openByToken(second)).toBeNull()
    expect(shareUrl(await db.surprise.findUniqueOrThrow({ where: { id: s.id } }))).toBeNull()
    const third = tokenOf((await publish(s.id, u.id, { rotate: true, expiresAt: new Date(Date.now() - 1000) })).url)
    expect(await openByToken(third)).toBeNull()
  })

  it('archived surprises are not reachable; garbage tokens are rejected', async () => {
    const u = await makeUser()
    const s = await makeSurprise(u.id, true)
    const t = tokenOf((await publish(s.id, u.id)).url)
    await archive(s.id, u.id, true)
    expect(await openByToken(t)).toBeNull()
    await archive(s.id, u.id, false)
    expect(await openByToken(t)).not.toBeNull()
    expect(await openByToken("'; drop table x; --")).toBeNull()
  })
})

describe('engagement', () => {
  it('counts opens and only moves progress forward', async () => {
    const u = await makeUser()
    const s = await makeSurprise(u.id, true)
    const t = tokenOf((await publish(s.id, u.id)).url)
    await recordEngagement(t, { type: 'open' })
    await recordEngagement(t, { type: 'progress', percent: 60 })
    await recordEngagement(t, { type: 'progress', percent: 20 })
    let row = await db.surprise.findUniqueOrThrow({ where: { id: s.id } })
    expect([row.openCount, row.progress, row.completedAt]).toEqual([1, 60, null])
    await recordEngagement(t, { type: 'progress', percent: 100 })
    row = await db.surprise.findUniqueOrThrow({ where: { id: s.id } })
    expect(row.completedAt).not.toBeNull()
  })
})

describe('dashboard actions', () => {
  it('duplicates without the link, and delete cascades', async () => {
    const u = await makeUser()
    const s = await makeSurprise(u.id, true)
    await publish(s.id, u.id)
    const copy = await duplicate(s.id, u.id)
    expect(copy.status).toBe('DRAFT')
    expect(copy.linkTokenHash).toBeNull()
    await db.delivery.create({ data: { surpriseId: s.id, recipientEmail: 'a@b.c', subject: 's', message: 'm', scheduledFor: new Date(), timezone: 'UTC', idempotencyKey: `k-${s.id}` } })
    await remove(s.id, u.id)
    expect(await db.delivery.count({ where: { surpriseId: s.id } })).toBe(0)
  })
})

describe('guest sessions and accounts', () => {
  it('a guest keeps their identity across requests via the session cookie', async () => {
    jar.clear()
    const { ensureUser, currentUser } = await import('@/lib/session')
    const a = await ensureUser()
    const b = await currentUser()
    expect(b?.id).toBe(a.id)
    const raw = [...jar.values()][0]
    expect(await db.session.count({ where: { tokenHash: raw } })).toBe(0) // only the hash is stored
  })

  it('signing up upgrades the guest in place, so drafts and surprises are kept', async () => {
    jar.clear()
    const { ensureUser } = await import('@/lib/session')
    const guest = await ensureUser()
    const s = await makeSurprise(guest.id)
    vi.stubGlobal('fetch', vi.fn(async (url: string) => new Response(JSON.stringify(String(url).includes('getDetails') ? { data: [{ id: 'blk-1', email: 'maya@example.com', name: 'M' }] } : {}), { status: 200 })))
    const { completeSignIn } = await import('@/server/accounts')
    const user = await completeSignIn('proxy-token')
    expect(user.id).toBe(guest.id)
    expect(user.isGuest).toBe(false)
    expect((await db.surprise.findUniqueOrThrow({ where: { id: s.id } })).ownerId).toBe(guest.id)

    // A different guest signing in to the same account brings their surprises along.
    jar.clear()
    const guest2 = await ensureUser()
    const s2 = await makeSurprise(guest2.id)
    const same = await completeSignIn('proxy-token')
    expect(same.id).toBe(guest.id)
    expect((await db.surprise.findUniqueOrThrow({ where: { id: s2.id } })).ownerId).toBe(guest.id)
    vi.unstubAllGlobals()
  })
})

describe('time-locked content', () => {
  it('withholds locked scenes and locked letters on the server', async () => {
    const { withLockedContentHidden } = await import('@/server/surprises')
    const future = new Date(Date.now() + 864e5).toISOString()
    const doc = {
      version: 1 as const, theme: { palette: 'candy' as const, motion: 'full' as const },
      scenes: [
        { id: 'a', kind: 'content' as const, title: '', transition: 'fade' as const, blocks: [{ id: 'b1', type: 'open_when' as const, props: { letters: [{ when: 'sad', emoji: '💌', letter: 'secret', unlockAt: future }, { when: 'happy', emoji: '💌', letter: 'open' }] } }] },
        { id: 'c', kind: 'finale' as const, title: '', transition: 'fade' as const, unlockAt: future, blocks: [{ id: 'b2', type: 'paragraph' as const, props: { text: 'later' } }] },
      ],
    }
    const out = withLockedContentHidden(doc)
    expect((out.scenes[0].blocks[0].props.letters as { letter: string }[]).map((l) => l.letter)).toEqual(['', 'open'])
    expect(out.scenes[1].blocks).toEqual([])
  })
})

describe('published versions', () => {
  it('recipients see the frozen version until the creator publishes again', async () => {
    const u = await makeUser()
    const s = await makeSurprise(u.id, true)
    const t = tokenOf((await publish(s.id, u.id)).url)
    await saveContent(s.id, u.id, { ...cardsOutput, title: 'Edited title', type: 'cards' } as never)
    expect((await openByToken(t))?.doc.scenes[0].blocks[0].props.text).toBe('For Maya')
    const again = tokenOf((await publish(s.id, u.id)).url)
    expect(again).toBe(t)
    expect((await openByToken(t))?.doc.scenes[0].blocks[0].props.text).toBe('Edited title')
    expect(await db.surpriseVersion.count({ where: { surpriseId: s.id } })).toBe(2)
  })

  it('surprises published before versions existed still open (converted on the fly)', async () => {
    const u = await makeUser()
    const s = await makeSurprise(u.id, true)
    const t = tokenOf((await publish(s.id, u.id)).url)
    await db.surprise.update({ where: { id: s.id }, data: { publishedVersionId: null } })
    expect((await openByToken(t))?.doc.scenes).toHaveLength(3)
    // and the first edit freezes what they saw instead of changing it under them
    await saveContent(s.id, u.id, { ...cardsOutput, title: 'Edited', type: 'cards' } as never)
    expect((await openByToken(t))?.doc.scenes[0].blocks[0].props.text).toBe('For Maya')
  })
})
