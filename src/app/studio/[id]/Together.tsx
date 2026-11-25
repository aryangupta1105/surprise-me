'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button, Card, Chip, Input, api, useToast } from '@/components/ui'
import type { EditorSurprise } from './StudioEditor'

type Reaction = { id: string; emoji: string; message: string; fromName: string; createdAt: string }
type Contribution = { id: string; name: string; message: string; status: 'pending' | 'added' | 'hidden'; createdAt: string }
const when = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })

/** Optional password on the private link (on top of the unguessable link itself). */
export function LinkPasswordCard({ s, setS }: { s: EditorSurprise; setS: (f: (x: EditorSurprise) => EditorSurprise) => void }) {
  const toast = useToast()
  const [pw, setPw] = useState('')
  const [busy, setBusy] = useState(false)
  const set = async (password: string | null) => {
    setBusy(true)
    try {
      await api(`/api/surprises/${s.id}/link-password`, { body: { password } })
      setS((x) => ({ ...x, hasLinkPassword: password !== null }))
      setPw('')
      toast(password ? 'Password set — tell them separately' : 'Password removed', 'good')
    } catch (e) {
      toast((e as Error).message, 'bad')
    } finally {
      setBusy(false)
    }
  }
  return (
    <Card className="p-6 sm:p-8">
      <h2 className="font-display text-2xl flex items-center gap-3">Password {s.hasLinkPassword && <Chip tone="good">on</Chip>}</h2>
      <p className="text-ink-soft mt-1 text-sm">Optional. The link is already private; a password adds a second lock — handy if the link might get forwarded.</p>
      <form onSubmit={(e) => { e.preventDefault(); set(pw) }} className="mt-4 flex gap-2">
        <Input type="text" value={pw} onChange={(e) => setPw(e.target.value)} placeholder={s.hasLinkPassword ? 'New password' : 'e.g. our first city'} minLength={4} maxLength={100} aria-label="Link password" autoComplete="off" />
        <Button type="submit" variant="secondary" loading={busy} disabled={pw.length < 4}>{s.hasLinkPassword ? 'Change' : 'Set'}</Button>
      </form>
      {s.hasLinkPassword && <button onClick={() => set(null)} className="mt-3 text-sm text-ink-soft hover:text-ink">Remove password</button>}
    </Card>
  )
}

/** Group messages from friends (via an invite link) and the recipient's reactions. */
export function TogetherCard({ s }: { s: EditorSurprise }) {
  const toast = useToast()
  const [invite, setInvite] = useState<string | null>(null)
  const [contribs, setContribs] = useState<Contribution[]>([])
  const [reactions, setReactions] = useState<Reaction[]>([])
  const [picked, setPicked] = useState<string[]>([])
  const [busy, setBusy] = useState(false)

  const fetchAll = useCallback(
    () =>
      Promise.all([
        api<{ inviteUrl: string | null; contributions: Contribution[] }>(`/api/surprises/${s.id}/contributions`),
        api<{ reactions: Reaction[] }>(`/api/surprises/${s.id}/reactions`),
      ]),
    [s.id],
  )
  const show = ([c, r]: Awaited<ReturnType<typeof fetchAll>>) => {
    setInvite(c.inviteUrl)
    setContribs(c.contributions)
    setReactions(r.reactions)
  }
  const load = async () => show(await fetchAll())
  useEffect(() => {
    fetchAll().then(([c, r]) => {
      setInvite(c.inviteUrl)
      setContribs(c.contributions)
      setReactions(r.reactions)
    }, () => {})
  }, [fetchAll])

  const act = async (body: object, done?: string) => {
    setBusy(true)
    try {
      const r = await api<{ inviteUrl?: string | null; added?: number }>(`/api/surprises/${s.id}/contributions`, { body })
      if ('inviteUrl' in r) setInvite(r.inviteUrl ?? null)
      if (r.added) {
        toast(`Added ${r.added} message(s) as a new scene before the finale`, 'good')
        window.location.reload() // reopen the editor with the updated draft
        return
      }
      if (done) toast(done, 'good')
      await load()
    } catch (e) {
      toast((e as Error).message, 'bad')
    } finally {
      setBusy(false)
    }
  }
  const pending = contribs.filter((c) => c.status === 'pending')

  return (
    <Card className="p-6 sm:p-8">
      <h2 className="font-display text-2xl">Together</h2>

      <h3 className="font-semibold mt-4">Messages from friends</h3>
      <p className="text-ink-soft text-sm mt-1">Share an invite link with friends and family. They add a note (no sign-up); you choose what goes in.</p>
      {invite ? (
        <>
          <div className="mt-3 flex gap-2">
            <Input readOnly value={invite} onFocus={(e) => e.target.select()} aria-label="Invite link" className="font-mono text-xs" />
            <Button size="sm" onClick={() => navigator.clipboard.writeText(invite).then(() => toast('Invite link copied', 'good'))}>Copy</Button>
          </div>
          <button onClick={() => act({ action: 'invite', on: false }, 'Invite link turned off')} className="mt-2 text-sm text-ink-soft hover:text-ink">Turn off invite link</button>
        </>
      ) : (
        <Button size="sm" variant="secondary" className="mt-3" loading={busy} onClick={() => act({ action: 'invite', on: true })}>Get an invite link</Button>
      )}
      {contribs.length > 0 && (
        <ul className="mt-4 space-y-2">
          {contribs.map((c) => (
            <li key={c.id} className="rounded-2xl ring-1 ring-line p-3 flex gap-3 items-start">
              {c.status === 'pending' && <input type="checkbox" className="size-4 mt-1" checked={picked.includes(c.id)} onChange={(e) => setPicked((p) => (e.target.checked ? [...p, c.id] : p.filter((x) => x !== c.id)))} aria-label={`Include ${c.name}'s message`} />}
              <div className="flex-1 min-w-0">
                <p className="text-sm"><b>{c.name}</b> <span className="text-ink-soft">· {when(c.createdAt)}</span> {c.status !== 'pending' && <Chip tone={c.status === 'added' ? 'good' : 'neutral'}>{c.status}</Chip>}</p>
                <p className="text-sm mt-1 whitespace-pre-line break-words">{c.message}</p>
              </div>
              {c.status !== 'added' && (
                <button className="text-xs text-ink-soft hover:text-ink" onClick={() => act({ action: 'status', contributionId: c.id, status: c.status === 'hidden' ? 'pending' : 'hidden' })}>{c.status === 'hidden' ? 'Unhide' : 'Hide'}</button>
              )}
            </li>
          ))}
        </ul>
      )}
      {pending.length > 0 && (
        <Button size="sm" className="mt-3" disabled={!picked.length} loading={busy} onClick={() => act({ action: 'add', ids: picked })}>Add {picked.length || ''} to the surprise</Button>
      )}

      <h3 className="font-semibold mt-8">Their reactions</h3>
      {reactions.length ? (
        <ul className="mt-3 space-y-2">
          {reactions.map((r) => (
            <li key={r.id} className="rounded-2xl bg-cream p-3 flex gap-3">
              <span className="text-2xl" aria-hidden>{r.emoji}</span>
              <div className="min-w-0">
                <p className="text-sm">{r.message || <span className="text-ink-soft">(no message)</span>}</p>
                <p className="text-xs text-ink-soft mt-1">{r.fromName || 'Them'} · {when(r.createdAt)}</p>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-ink-soft mt-1">When they reach the end they can send you a reaction — it shows up here.</p>
      )}
    </Card>
  )
}
