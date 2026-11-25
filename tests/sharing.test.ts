import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/lib/db'
import { composeTemplates } from '@/engine/compose'
import { draftDoc, openByToken, publish, saveDraftDoc } from '@/server/surprises'
import { addContributionsToDraft, addReaction, contribute, contributionsFor, linkState, reactionsFor, setContributionStatus, setInvite, setLinkPassword, unlockLink } from '@/server/sharing'
import { makeSurprise, makeUser } from './fixtures'
import { jar } from './setup'

beforeEach(() => jar.clear())

async function published() {
  const u = await makeUser()
  const s = await makeSurprise(u.id)
  await saveDraftDoc(s.id, u.id, composeTemplates(['blank'], { to: 'Maya', from: 'Rohan' }).doc, 'template')
  const { url } = await publish(s.id, u.id)
  return { u, s, token: url.split('/s/')[1] }
}

describe('link password', () => {
  it('locks the link until the right password, per browser, and re-locks when changed', async () => {
    const { u, s, token } = await published()
    await setLinkPassword(s.id, u.id, 'goa2019')
    expect(await openByToken(token)).toBeNull()
    expect(await linkState(token)).toBe('locked')
    await expect(unlockLink(token, 'wrong')).rejects.toMatchObject({ status: 401 })
    await unlockLink(token, 'goa2019')
    expect(await openByToken(token)).not.toBeNull()
    await setLinkPassword(s.id, u.id, 'another1')
    expect(await openByToken(token)).toBeNull() // old cookie no longer matches
    await setLinkPassword(s.id, u.id, null)
    expect(await linkState(token)).toBe('open')
    const other = await makeUser()
    await expect(setLinkPassword(s.id, other.id, 'xxxx')).rejects.toMatchObject({ status: 404 })
  })
})

describe('reactions', () => {
  it('recipient reacts through the link; only the owner reads them', async () => {
    const { u, s, token } = await published()
    await addReaction(token, { emoji: '😭', message: 'I cried', fromName: 'Maya' })
    await expect(addReaction(token, { emoji: '<script>' as never })).rejects.toThrow()
    await expect(addReaction('x'.repeat(30), { emoji: '❤️' })).rejects.toMatchObject({ status: 404 })
    expect((await reactionsFor(s.id, u.id)).map((r) => [r.emoji, r.message])).toEqual([['😭', 'I cried']])
    await expect(reactionsFor(s.id, (await makeUser()).id)).rejects.toMatchObject({ status: 404 })
  })
})

describe('group messages', () => {
  it('invite → friends contribute → owner adds chosen ones as a scene before the finale', async () => {
    const { u, s } = await published()
    const url = (await setInvite(s.id, u.id, true))!
    const token = url.split('/c/')[1]
    await contribute(token, { name: 'Asha', message: 'Happy birthday, legend!' })
    await contribute(token, { name: 'Dev', message: 'Miss you lots' })
    await expect(contribute(token, { name: '', message: 'hi there' })).rejects.toThrow()
    const { contributions, inviteUrl } = await contributionsFor(s.id, u.id)
    expect(inviteUrl).toBe(url)
    await setContributionStatus(s.id, u.id, contributions[1].id, 'hidden')
    expect(await addContributionsToDraft(s.id, u.id, contributions.map((c) => c.id))).toBe(1) // hidden ones are skipped
    const doc = await draftDoc(await db.surprise.findUniqueOrThrow({ where: { id: s.id } }))
    const i = doc.scenes.findIndex((x) => x.title === 'Messages from friends')
    expect(doc.scenes[i + 1].kind).toBe('finale')
    expect(doc.scenes[i].blocks.find((b) => b.type === 'quote')?.props).toEqual({ text: 'Happy birthday, legend!', by: 'Asha' })
    await setInvite(s.id, u.id, false)
    await expect(contribute(token, { name: 'Late', message: 'Too late?' })).rejects.toMatchObject({ status: 404 })
  })
})
