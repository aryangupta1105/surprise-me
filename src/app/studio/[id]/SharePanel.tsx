'use client'

import { useCallback, useEffect, useState } from 'react'
import { openAccount } from '@/components/AccountDialog'
import { ConnectRow, useConnections } from '@/components/Connections'
import { LinkPasswordCard, TogetherCard } from './Together'
import { Button, Card, Chip, Field, Input, Modal, Select, Textarea, api, useToast } from '@/components/ui'
import { CALENDAR_TIMEZONES } from '@/lib/catalog'
import { emailHtml } from '@/lib/email'
import type { EditorSurprise } from './StudioEditor'

type Delivery = { id: string; recipientEmail: string; subject: string; scheduledFor: string; timezone: string; status: 'SCHEDULED' | 'SENDING' | 'SENT' | 'FAILED' | 'CANCELLED'; lastError: string | null; sentAt: string | null }
type Reminder = { id: string; title: string; occasionDate: string; status: 'CREATED' | 'FAILED'; eventLink: string | null; error: string | null }

const tone = { SCHEDULED: 'info', SENDING: 'warn', SENT: 'good', FAILED: 'bad', CANCELLED: 'neutral' } as const
const fmt = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
const localTz = () => Intl.DateTimeFormat().resolvedOptions().timeZone

export function SharePanel({ s, setS, dirty, save, isGuest }: { s: EditorSurprise; setS: (f: (x: EditorSurprise) => EditorSurprise) => void; dirty: boolean; save: () => Promise<boolean | void>; isGuest: boolean }) {
  const toast = useToast()
  const conns = useConnections()
  const [busy, setBusy] = useState<string | null>(null)
  const [deliveries, setDeliveries] = useState<Delivery[]>([])
  const [reminders, setReminders] = useState<Reminder[]>([])
  const live = s.url && !s.linkRevokedAt && s.status === 'PUBLISHED'

  const load = useCallback(async () => {
    const r = await api<{ deliveries: Delivery[]; reminders: Reminder[] }>(`/api/surprises/${s.id}`)
    setDeliveries(r.deliveries)
    setReminders(r.reminders)
  }, [s.id])
  useEffect(() => {
    api<{ deliveries: Delivery[]; reminders: Reminder[] }>(`/api/surprises/${s.id}`).then((r) => {
      setDeliveries(r.deliveries)
      setReminders(r.reminders)
    }, () => {})
  }, [s.id])

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key)
    try {
      await fn()
    } catch (e) {
      toast((e as Error).message, 'bad')
    } finally {
      setBusy(null)
    }
  }

  const publish = (rotate = false) =>
    run(rotate ? 'rotate' : 'publish', async () => {
      if (dirty && !(await save())) return
      const { url } = await api<{ url: string }>(`/api/surprises/${s.id}/publish`, { body: { rotate } })
      setS((x) => ({ ...x, url, status: 'PUBLISHED', linkRevokedAt: null }))
      toast(rotate ? 'New link created — the old one no longer works' : live ? 'Changes published — same link' : 'Published! 🎉', 'good')
    })

  const revoke = () =>
    run('revoke', async () => {
      if (!confirm('Turn off this link? Anyone who has it will no longer be able to open the surprise.')) return
      await api(`/api/surprises/${s.id}/revoke`, { body: {} })
      setS((x) => ({ ...x, linkRevokedAt: new Date().toISOString() }))
      toast('Link turned off', 'info')
    })

  const copy = async () => {
    await navigator.clipboard.writeText(s.url!)
    toast('Link copied', 'good')
  }

  return (
    <div className="grid lg:grid-cols-2 gap-6 items-start">
      <div className="space-y-6">
        <Card className="p-6 sm:p-8">
          <h2 className="font-display text-2xl">Private link</h2>
          {live ? (
            <>
              <p className="text-ink-soft mt-1 text-sm">Anyone with this link can open the surprise — no account needed. It’s never listed in search engines.</p>
              <div className="mt-5 flex gap-2">
                <Input readOnly value={s.url!} onFocus={(e) => e.target.select()} aria-label="Private link" className="font-mono text-sm" />
                <Button onClick={copy}>Copy</Button>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" href={s.url!}>Open as recipient ↗</Button>
                {typeof navigator !== 'undefined' && 'share' in navigator && (
                  <Button size="sm" variant="secondary" onClick={() => navigator.share({ title: 'A surprise for you', url: s.url! }).catch(() => {})}>Share…</Button>
                )}
                <Button size="sm" onClick={() => publish(false)} loading={busy === 'publish'}>Publish changes</Button>
                <Button size="sm" variant="ghost" onClick={() => publish(true)} loading={busy === 'rotate'}>New link</Button>
                <Button size="sm" variant="danger" onClick={revoke} loading={busy === 'revoke'}>Turn off link</Button>
              </div>
              <p className="text-xs text-ink-soft mt-4">They see the version you last published. After editing, click <b>Publish changes</b> — the link stays the same.</p>
              {isGuest && (
                <div className="mt-5 rounded-2xl bg-cream p-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                  <p className="text-sm"><b>Keep it safe.</b> Right now it lives in this browser only. A free account keeps it — and your reactions — on any device.</p>
                  <Button size="sm" onClick={() => openAccount('Create a free account to keep this surprise safe and see their reactions on any device.')}>Create free account</Button>
                </div>
              )}
            </>
          ) : (
            <>
              <p className="text-ink-soft mt-1">{s.linkRevokedAt ? 'The link is turned off. Publish to create a new one.' : 'When you’re happy with it, publish to get a private link.'}</p>
              <Button className="mt-5" size="lg" onClick={() => publish(Boolean(s.linkRevokedAt))} loading={busy === 'publish' || busy === 'rotate'}>Publish surprise ✨</Button>
            </>
          )}
        </Card>

        <Card className="p-6 sm:p-8">
          <h2 className="font-display text-2xl">How it’s going</h2>
          <div className="grid grid-cols-3 gap-3 mt-4 text-center">
            <Stat label="Opens" value={String(s.openCount)} />
            <Stat label="Progress" value={`${s.progress}%`} />
            <Stat label="Finished" value={s.completedAt ? '✓' : '—'} />
          </div>
          <p className="text-xs text-ink-soft mt-4">{s.lastOpenedAt ? `Last opened ${fmt(s.lastOpenedAt)}.` : 'Not opened yet.'} We only count opens and progress — nothing about who opened it.</p>
        </Card>

        <LinkPasswordCard s={s} setS={setS} />
        <TogetherCard s={s} />

        <ReminderCard surpriseId={s.id} recipientName={s.recipientName} reminders={reminders} conns={conns} onCreated={load} />
      </div>

      <EmailCard s={s} live={Boolean(live)} conns={conns} deliveries={deliveries} reload={load} isGuest={isGuest} />
    </div>
  )
}

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-2xl bg-cream p-4">
    <p className="font-display text-3xl">{value}</p>
    <p className="text-xs font-semibold text-ink-soft mt-1">{label}</p>
  </div>
)

function EmailCard({ s, live, conns, deliveries, reload, isGuest }: { s: EditorSurprise; live: boolean; conns: ReturnType<typeof useConnections>; deliveries: Delivery[]; reload: () => Promise<void>; isGuest: boolean }) {
  const toast = useToast()
  const [to, setTo] = useState('')
  const [subject, setSubject] = useState(`${s.creatorName} made you something 🎁`)
  const [message, setMessage] = useState(`Hi ${s.recipientName},\n\nI made a little something just for you. Open it when you have a quiet moment.`)
  const [when, setWhen] = useState<'now' | 'later'>('now')
  const [at, setAt] = useState('')
  const [preview, setPreview] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [key, setKey] = useState(() => crypto.randomUUID())
  const gmail = conns.get('gmail')

  const send = async () => {
    setBusy(true)
    try {
      const sendAt = when === 'later' ? new Date(at).toISOString() : null
      const { delivery } = await api<{ delivery: Delivery }>(`/api/surprises/${s.id}/deliveries`, {
        body: { recipientEmail: to, subject, message, sendAt, timezone: localTz(), idempotencyKey: key, confirmed },
      })
      if (delivery.status === 'FAILED') toast(`Gmail refused it: ${delivery.lastError}`, 'bad')
      else toast(delivery.status === 'SENT' ? 'Sent! 💌' : `Scheduled for ${fmt(delivery.scheduledFor)}`, 'good')
      setKey(crypto.randomUUID())
      setConfirmed(false)
      setPreview(false)
      await reload()
    } catch (e) {
      toast((e as Error).message, 'bad')
    } finally {
      setBusy(false)
    }
  }

  const act = async (id: string, body: object) => {
    try {
      await api(`/api/deliveries/${id}`, { body })
      await reload()
    } catch (e) {
      toast((e as Error).message, 'bad')
    }
  }

  const valid = /\S+@\S+\.\S+/.test(to) && subject.trim() && message.trim() && (when === 'now' || Boolean(at)) // the server rejects past times

  return (
    <Card className="p-6 sm:p-8">
      <h2 className="font-display text-2xl">Send by email</h2>
      <p className="text-ink-soft mt-1 text-sm">Sent from your own Gmail, so it lands like a real note from you.</p>
      <div className="mt-5"><ConnectRow app="gmail" conns={conns} /></div>
      {isGuest && (
        <p className="text-sm mt-3 rounded-2xl bg-cream p-3">Sending email needs a free account (so messages always come from a real person). <button className="font-semibold text-rose" onClick={() => openAccount('Create a free account to send your surprise by email — it takes a few seconds and keeps everything you’ve made.')}>Create one →</button></p>
      )}

      {!live ? (
        <p className="mt-6 rounded-2xl bg-cream p-4 text-sm">Publish the surprise first — the email carries its private link.</p>
      ) : gmail ? (
        <div className="mt-6 space-y-4">
          <Field label="Their email">{(id) => <Input id={id} type="email" value={to} onChange={(e) => setTo(e.target.value)} placeholder="maya@example.com" />}</Field>
          <Field label="Subject">{(id) => <Input id={id} value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={150} />}</Field>
          <Field label="Your message" hint="A button to open the surprise is added below it.">{(id) => <Textarea id={id} rows={5} value={message} onChange={(e) => setMessage(e.target.value)} maxLength={3000} />}</Field>
          <div className="flex gap-2" role="radiogroup" aria-label="When to send">
            {(['now', 'later'] as const).map((w) => (
              <button key={w} role="radio" aria-checked={when === w} onClick={() => setWhen(w)} className={`h-10 px-4 rounded-full text-sm font-semibold ring-1 ${when === w ? 'bg-ink text-white ring-ink' : 'ring-line bg-white'}`}>
                {w === 'now' ? 'Send now' : 'Schedule'}
              </button>
            ))}
          </div>
          {when === 'later' && (
            <Field label={`Send at (your time, ${localTz()})`}>{(id) => <Input id={id} type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} />}</Field>
          )}
          <Button variant="secondary" onClick={() => setPreview(true)} disabled={!valid}>Preview & send</Button>
        </div>
      ) : null}

      <Modal open={preview} onClose={() => setPreview(false)} title="Check before sending">
        <p className="text-sm"><b>To:</b> {to}<br /><b>Subject:</b> {subject}<br /><b>From:</b> your Gmail ({gmail?.label}) {when === 'later' && at && <><br /><b>When:</b> {fmt(new Date(at).toISOString())}</>}</p>
        <iframe title="Email preview" sandbox="" className="mt-4 w-full h-80 rounded-2xl ring-1 ring-line bg-white" srcDoc={emailHtml({ message, url: '#', creatorName: s.creatorName, recipientName: s.recipientName })} />
        <label className="flex items-start gap-3 mt-5 text-sm">
          <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-0.5 size-5 accent-[var(--color-rose)]" />
          I want SurpriseMe to send this email from my Gmail to {to}{when === 'later' ? ' at the time above' : ' now'}.
        </label>
        <Button className="mt-5 w-full" size="lg" onClick={send} loading={busy} disabled={!confirmed}>{when === 'now' ? 'Send now 💌' : 'Schedule it ⏰'}</Button>
      </Modal>

      {deliveries.length > 0 && (
        <div className="mt-8">
          <h3 className="font-semibold mb-3">Emails</h3>
          <ul className="space-y-3">
            {deliveries.map((d) => (
              <li key={d.id} className="rounded-2xl ring-1 ring-line bg-white p-4 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold truncate">{d.recipientEmail}</span>
                  <Chip tone={tone[d.status]}>{d.status.toLowerCase()}</Chip>
                </div>
                <p className="text-ink-soft mt-1">{d.status === 'SENT' && d.sentAt ? `Sent ${fmt(d.sentAt)}` : `${d.status === 'SCHEDULED' ? 'Sends' : 'Planned for'} ${fmt(d.scheduledFor)} (${d.timezone})`}</p>
                {d.lastError && <p className="text-rose-deep mt-1">{d.lastError}</p>}
                <div className="flex gap-2 mt-2">
                  {d.status === 'SCHEDULED' && <Button size="sm" variant="ghost" onClick={() => act(d.id, { action: 'cancel' })}>Cancel</Button>}
                  {d.status === 'FAILED' && <Button size="sm" variant="secondary" onClick={() => confirm('Retry sending this email? If it partly went through before, check your Gmail Sent folder first.') && act(d.id, { action: 'retry' })}>Retry</Button>}
                  {['SCHEDULED', 'CANCELLED', 'FAILED'].includes(d.status) && (
                    <Reschedule onPick={(iso) => act(d.id, { action: 'reschedule', sendAt: iso, timezone: localTz() })} />
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  )
}

function Reschedule({ onPick }: { onPick: (iso: string) => void }) {
  const [open, setOpen] = useState(false)
  const [v, setV] = useState('')
  if (!open) return <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>Reschedule</Button>
  return (
    <span className="flex gap-2">
      <Input type="datetime-local" value={v} onChange={(e) => setV(e.target.value)} className="h-9 py-1 text-sm" aria-label="New send time" />
      <Button size="sm" disabled={!v} onClick={() => (onPick(new Date(v).toISOString()), setOpen(false))}>Save</Button>
    </span>
  )
}

export function ReminderCard({ surpriseId, recipientName, defaultTitle, reminders, conns, onCreated }: { surpriseId?: string; recipientName: string; defaultTitle?: string; reminders: Reminder[]; conns: ReturnType<typeof useConnections>; onCreated: () => Promise<void> }) {
  const toast = useToast()
  const tz = localTz()
  const [title, setTitle] = useState(defaultTitle ?? `🎁 Send ${recipientName}'s surprise`)
  const [date, setDate] = useState('')
  const [days, setDays] = useState(3)
  const [time, setTime] = useState('09:00')
  const [timezone, setTimezone] = useState<string>((CALENDAR_TIMEZONES as readonly string[]).includes(tz) ? tz : 'Europe/London')
  const [busy, setBusy] = useState(false)
  const cal = conns.get('calendar')

  const create = async () => {
    setBusy(true)
    try {
      await api('/api/reminders', { body: { title, occasionDate: date, daysBefore: days, time, timezone, surpriseId, note: `Occasion${surpriseId ? ` for ${recipientName}` : ''} is on ${date}.` } })
      toast('Added to your calendar 📅', 'good')
      await onCreated()
    } catch (e) {
      toast((e as Error).message, 'bad')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="p-6 sm:p-8">
      <h2 className="font-display text-2xl">Calendar reminder</h2>
      <p className="text-ink-soft mt-1 text-sm">We add a short event to your Google Calendar a few days before the occasion.</p>
      <div className="mt-5"><ConnectRow app="calendar" conns={conns} /></div>
      {cal && (
        <div className="mt-6 grid sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2"><Field label="Reminder title">{(id) => <Input id={id} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />}</Field></div>
          <Field label="Occasion date">{(id) => <Input id={id} type="date" value={date} onChange={(e) => setDate(e.target.value)} />}</Field>
          <Field label="Remind me">
            {(id) => (
              <Select id={id} value={days} onChange={(e) => setDays(Number(e.target.value))}>
                {[0, 1, 2, 3, 7, 14].map((d) => <option key={d} value={d}>{d === 0 ? 'On the day' : `${d} day${d > 1 ? 's' : ''} before`}</option>)}
              </Select>
            )}
          </Field>
          <Field label="At">{(id) => <Input id={id} type="time" value={time} onChange={(e) => setTime(e.target.value)} />}</Field>
          <Field label="Time zone" hint="Google Calendar’s supported list.">
            {(id) => <Select id={id} value={timezone} onChange={(e) => setTimezone(e.target.value)}>{CALENDAR_TIMEZONES.map((t) => <option key={t}>{t}</option>)}</Select>}
          </Field>
          <div className="sm:col-span-2"><Button onClick={create} loading={busy} disabled={!date || !title.trim()}>Add reminder</Button></div>
        </div>
      )}
      {reminders.length > 0 && (
        <ul className="mt-6 space-y-2 text-sm">
          {reminders.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-2 rounded-2xl ring-1 ring-line bg-white p-3">
              <span className="truncate">{r.title}</span>
              {r.status === 'CREATED' ? (r.eventLink ? <a className="font-semibold text-rose" href={r.eventLink} target="_blank" rel="noreferrer">Open ↗</a> : <Chip tone="good">added</Chip>) : <Chip tone="bad">failed</Chip>}
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
