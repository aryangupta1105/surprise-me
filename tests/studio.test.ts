import { describe, expect, it } from 'vitest'
import { db } from '@/lib/db'
import { composeTemplates } from '@/engine/compose'
import { parseDoc } from '@/engine/doc'
import * as ops from '@/engine/ops'
import { convertToScenes, draftDoc, listVersions, openByToken, publish, saveDraftDoc, versionDoc, withLockedContentHidden } from '@/server/surprises'
import { makeSurprise, makeUser } from './fixtures'

const names = { to: 'Maya', from: 'Rohan' }

describe('music and backgrounds', () => {
  const base = composeTemplates(['blank'], names).doc
  it('accepts a soundtrack and per-scene music/background with defaults', () => {
    let d = ops.setTheme(base, { music: { audioId: 'a1', title: '', volume: 0.6, loop: true } })
    d = ops.updateScene(d, d.scenes[1].id, { background: { photoId: 'p1', visibility: 0.5 }, music: { audioId: 'a2', title: 'Ours', volume: 0.3, loop: false } })
    const parsed = parseDoc(JSON.parse(JSON.stringify({ ...d, scenes: d.scenes.map((s, i) => (i === 1 ? { ...s, background: { photoId: 'p1' } } : s)) })))
    expect(parsed.scenes[1].background).toEqual({ photoId: 'p1', visibility: 0.5 })
    expect(parsed.theme.music?.audioId).toBe('a1')
    expect(() => ops.setTheme(base, { music: { audioId: 'a1', title: '', volume: 2, loop: true } })).toThrow()
  })
  it('withholds a locked scene’s music and background too', () => {
    const d = ops.updateScene(base, base.scenes[1].id, { unlockAt: new Date(Date.now() + 86_400_000).toISOString(), background: { photoId: 'p1', visibility: 0.5 }, music: { audioId: 'a2', title: '', volume: 0.5, loop: true } })
    const hidden = withLockedContentHidden(d).scenes[1]
    expect([hidden.blocks.length, hidden.background, hidden.music]).toEqual([0, undefined, undefined])
  })
  it('blank canvas is opening + one scene + finale', () => {
    expect(base.scenes.map((s) => s.kind)).toEqual(['opening', 'content', 'finale'])
  })
})

describe('version history', () => {
  it('lists versions newest first and restores only the owner’s', async () => {
    const u = await makeUser()
    const s = await makeSurprise(u.id)
    const doc = composeTemplates(['blank'], names).doc
    const v1 = await saveDraftDoc(s.id, u.id, doc, 'template')
    await saveDraftDoc(s.id, u.id, ops.removeScene(doc, doc.scenes[1].id), 'autosave')
    const list = await listVersions(s.id, u.id)
    expect(list.map((v) => [v.source, v.scenes])).toEqual([['autosave', 2], ['template', 3]])
    expect((await versionDoc(s.id, u.id, v1.id)).scenes).toHaveLength(3)
    const other = await makeUser()
    await expect(versionDoc(s.id, other.id, v1.id)).rejects.toMatchObject({ status: 404 })
    const s2 = await makeSurprise(u.id)
    await expect(versionDoc(s2.id, u.id, v1.id)).rejects.toMatchObject({ status: 404 }) // version of another surprise
  })
})

describe('switching a single-experience surprise to scenes', () => {
  it('creates a draft document and freezes what an old link shows', async () => {
    const u = await makeUser()
    const s = await makeSurprise(u.id, true)
    const { url } = await publish(s.id, u.id)
    await db.surprise.update({ where: { id: s.id }, data: { publishedVersionId: null } }) // as if published before versions existed
    await convertToScenes(s.id, u.id)
    const after = await db.surprise.findUniqueOrThrow({ where: { id: s.id } })
    expect(after.draftVersionId).toBeTruthy()
    expect(after.publishedVersionId).toBeTruthy()
    const doc = await draftDoc(after)
    expect(doc.scenes.map((x) => x.kind)).toEqual(['opening', 'game', 'finale'])
    expect((await openByToken(url.split('/s/')[1]))?.doc.scenes).toHaveLength(3)
    await convertToScenes(s.id, u.id) // idempotent
    expect((await db.surprise.findUniqueOrThrow({ where: { id: s.id } })).draftVersionId).toBe(after.draftVersionId)
  })
})
