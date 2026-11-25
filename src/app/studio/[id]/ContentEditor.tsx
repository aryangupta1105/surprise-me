'use client'

import { useState } from 'react'
import type { core } from 'zod'
import { Button, Card, Field, Input, Textarea, api, useToast } from '@/components/ui'
import { SECTION_LISTS, type StoredContent } from '@/lib/schemas'

type Item = Record<string, unknown>
type FieldDef = { key: string; label: string; long?: boolean; kind?: 'list' | 'photo' | 'datetime' | 'options' }

const ITEM_FIELDS: Record<StoredContent['type'], FieldDef[]> = {
  treasure_hunt: [
    { key: 'riddle', label: 'Riddle', long: true },
    { key: 'answer', label: 'Answer' },
    { key: 'acceptedAnswers', label: 'Also accept (comma separated)', kind: 'list' },
    { key: 'hint', label: 'Hint' },
    { key: 'successMessage', label: 'Message when solved', long: true },
  ],
  memory_journey: [
    { key: 'emoji', label: 'Emoji' },
    { key: 'heading', label: 'Heading' },
    { key: 'dateLabel', label: 'Date (as you remember it)' },
    { key: 'story', label: 'Story', long: true },
    { key: 'photoId', label: 'Photo', kind: 'photo' },
  ],
  quiz: [
    { key: 'question', label: 'Question' },
    { key: 'options', label: 'Answers (pick the correct one)', kind: 'options' },
    { key: 'reveal', label: 'Explanation after answering', long: true },
  ],
  gift_reveal: [
    { key: 'label', label: 'Stage label' },
    { key: 'message', label: 'Message', long: true },
  ],
  cards: [
    { key: 'emoji', label: 'Emoji' },
    { key: 'heading', label: 'Front of card' },
    { key: 'body', label: 'Back of card', long: true },
  ],
  open_when: [
    { key: 'emoji', label: 'Emoji' },
    { key: 'when', label: 'Open when…' },
    { key: 'letter', label: 'Letter', long: true },
    { key: 'unlockAt', label: 'Lock until (optional)', kind: 'datetime' },
  ],
}
const MIN_ITEMS: Record<StoredContent['type'], number> = { treasure_hunt: 3, memory_journey: 1, quiz: 4, gift_reveal: 2, cards: 5, open_when: 1 }

const toLocalInput = (iso?: string) => (iso ? new Date(new Date(iso).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '')

export function ContentEditor({ surpriseId, content, onChange, issues }: { surpriseId: string; content: StoredContent; onChange: (c: StoredContent) => void; issues: core.$ZodIssue[] }) {
  const listKey = SECTION_LISTS[content.type]
  const items = (content as unknown as Record<string, Item[]>)[listKey]
  const c = content as unknown as Record<string, unknown>
  const set = (patch: Record<string, unknown>) => onChange({ ...content, ...patch } as StoredContent)
  const setItem = (i: number, patch: Item) => set({ [listKey]: items.map((it, j) => (j === i ? { ...it, ...patch } : it)) })
  const issueAt = (...path: (string | number)[]) => issues.find((x) => path.every((p, i) => x.path[i] === p))?.message

  return (
    <div className="space-y-6">
      <Card className="p-6 space-y-4">
        <h2 className="font-semibold">Opening & ending</h2>
        <Field label="Title" error={issueAt('title')}>{(id) => <Input id={id} value={content.title} onChange={(e) => set({ title: e.target.value })} />}</Field>
        <Field label="Subtitle" error={issueAt('subtitle')}>{(id) => <Input id={id} value={content.subtitle} onChange={(e) => set({ subtitle: e.target.value })} />}</Field>
        <Field label="Intro" error={issueAt('intro')}>{(id) => <Textarea id={id} value={content.intro} onChange={(e) => set({ intro: e.target.value })} />}</Field>
        {content.type === 'cards' && <Field label="Deck title">{(id) => <Input id={id} value={content.deckTitle} onChange={(e) => set({ deckTitle: e.target.value })} />}</Field>}
        {content.type === 'gift_reveal' && (
          <>
            <Field label="Teaser lines (one per line)" hint="Shown one after another before the box appears.">
              {(id) => <Textarea id={id} value={content.anticipation.join('\n')} onChange={(e) => set({ anticipation: e.target.value.split('\n').slice(0, 4) })} />}
            </Field>
            <Field label="Gift title">{(id) => <Input id={id} value={content.gift.title} onChange={(e) => set({ gift: { ...content.gift, title: e.target.value } })} />}</Field>
            <Field label="Gift message">{(id) => <Textarea id={id} rows={4} value={content.gift.message} onChange={(e) => set({ gift: { ...content.gift, message: e.target.value } })} />}</Field>
            <Field label="Gift photo" optional>{() => <PhotoInput surpriseId={surpriseId} value={content.giftPhotoId} onChange={(giftPhotoId) => set({ giftPhotoId })} />}</Field>
          </>
        )}
        {content.type === 'quiz' && (
          <div className="grid sm:grid-cols-3 gap-3">
            {(['high', 'medium', 'low'] as const).map((k) => (
              <Field key={k} label={`Result: ${k} score`}>{(id) => <Textarea id={id} value={content.results[k]} onChange={(e) => set({ results: { ...content.results, [k]: e.target.value } })} />}</Field>
            ))}
          </div>
        )}
        <Field label="Closing title" error={issueAt('closing', 'title')}>{(id) => <Input id={id} value={content.closing.title} onChange={(e) => set({ closing: { ...content.closing, title: e.target.value } })} />}</Field>
        <Field label="Closing message" error={issueAt('closing', 'message')}>{(id) => <Textarea id={id} rows={4} value={content.closing.message} onChange={(e) => set({ closing: { ...content.closing, message: e.target.value } })} />}</Field>
      </Card>

      {items.map((item, i) => (
        <ItemCard
          key={i}
          index={i}
          surpriseId={surpriseId}
          type={content.type}
          item={item}
          error={issues.find((x) => x.path[0] === listKey && x.path[1] === i)?.message}
          onChange={(patch) => setItem(i, patch)}
          onRemove={items.length > MIN_ITEMS[content.type] ? () => set({ [listKey]: items.filter((_, j) => j !== i) }) : undefined}
        />
      ))}
      {c.type === 'memory_journey' && items.length < 10 && (
        <Button variant="secondary" onClick={() => set({ [listKey]: [...items, { emoji: '✨', heading: 'A new memory', dateLabel: '', story: 'Write it here…' }] })}>+ Add a moment</Button>
      )}
      {c.type === 'open_when' && items.length < 8 && (
        <Button variant="secondary" onClick={() => set({ [listKey]: [...items, { emoji: '💌', when: 'Open when…', letter: 'Write your letter here…' }] })}>+ Add a letter</Button>
      )}
    </div>
  )
}

function ItemCard({ index, surpriseId, type, item, onChange, onRemove, error }: { index: number; surpriseId: string; type: StoredContent['type']; item: Item; onChange: (p: Item) => void; onRemove?: () => void; error?: string }) {
  const toast = useToast()
  const [note, setNote] = useState('')
  const [asking, setAsking] = useState(false)
  const [busy, setBusy] = useState(false)

  const regenerate = async () => {
    setBusy(true)
    try {
      const { item: fresh } = await api<{ item: Item }>(`/api/surprises/${surpriseId}/regenerate`, { body: { index, note } })
      onChange({ ...fresh, photoId: item.photoId, unlockAt: item.unlockAt }) // keep the creator's photo and lock
      setAsking(false)
      setNote('')
      toast('Rewritten — save to keep it', 'good')
    } catch (e) {
      toast((e as Error).message, 'bad')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h3 className="font-semibold">#{index + 1}</h3>
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" onClick={() => setAsking(!asking)}>↻ Rewrite</Button>
          {onRemove && <Button size="sm" variant="ghost" onClick={onRemove} aria-label={`Remove #${index + 1}`}>Remove</Button>}
        </div>
      </div>
      {asking && (
        <div className="mb-5 rounded-2xl bg-cream p-4 flex flex-col sm:flex-row gap-2">
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional: make it funnier, mention Mochi…" maxLength={300} />
          <Button onClick={regenerate} loading={busy}>Rewrite this</Button>
        </div>
      )}
      {error && <p className="text-sm text-rose-deep mb-3" role="alert">{error}</p>}
      <div className="space-y-4">
        {ITEM_FIELDS[type].map((f) => (
          <Field key={f.key} label={f.label} optional={f.kind === 'photo' || f.kind === 'datetime'}>
            {(id) => {
              const v = item[f.key]
              if (f.kind === 'list')
                return <Input id={id} value={((v as string[]) ?? []).join(', ')} onChange={(e) => onChange({ [f.key]: e.target.value.split(',').map((x) => x.trim()).filter(Boolean).slice(0, 6) })} />
              if (f.kind === 'photo') return <PhotoInput surpriseId={surpriseId} value={v as string | undefined} onChange={(photoId) => onChange({ photoId })} />
              if (f.kind === 'datetime')
                return <Input id={id} type="datetime-local" value={toLocalInput(v as string | undefined)} onChange={(e) => onChange({ unlockAt: e.target.value ? new Date(e.target.value).toISOString() : undefined })} />
              if (f.kind === 'options') {
                const opts = v as string[]
                return (
                  <div className="space-y-2" id={id}>
                    {opts.map((o, oi) => (
                      <div key={oi} className="flex items-center gap-2">
                        <input type="radio" name={`correct-${index}`} checked={item.correctIndex === oi} onChange={() => onChange({ correctIndex: oi })} aria-label={`Mark option ${oi + 1} correct`} className="size-5 accent-[var(--color-rose)]" />
                        <Input value={o} onChange={(e) => onChange({ options: opts.map((x, j) => (j === oi ? e.target.value : x)) })} />
                      </div>
                    ))}
                  </div>
                )
              }
              return f.long ? <Textarea id={id} rows={4} value={String(v ?? '')} onChange={(e) => onChange({ [f.key]: e.target.value })} /> : <Input id={id} value={String(v ?? '')} onChange={(e) => onChange({ [f.key]: e.target.value })} />
            }}
          </Field>
        ))}
      </div>
    </Card>
  )
}

function PhotoInput({ surpriseId, value, onChange }: { surpriseId: string; value?: string; onChange: (id: string | undefined) => void }) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const upload = async (file: File) => {
    if (file.size > 3 * 1024 * 1024) return toast('Photos must be under 3 MB.', 'bad')
    setBusy(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('surpriseId', surpriseId)
      const { id } = await api<{ id: string }>('/api/uploads', { body: fd })
      onChange(id)
    } catch (e) {
      toast((e as Error).message, 'bad')
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="flex items-center gap-3">
      {value && (
        // eslint-disable-next-line @next/next/no-img-element -- private, auth-checked bytes
        <img src={`/api/uploads/${value}`} alt="" className="size-16 rounded-xl object-cover ring-1 ring-line" />
      )}
      <label className="inline-flex h-10 items-center px-4 rounded-full bg-white ring-1 ring-line text-sm font-semibold cursor-pointer hover:ring-ink/30">
        {busy ? 'Uploading…' : value ? 'Replace photo' : 'Add a photo'}
        <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="sr-only" disabled={busy} onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
      </label>
      {value && <button className="text-sm text-ink-soft hover:text-ink" onClick={() => onChange(undefined)}>Remove</button>}
    </div>
  )
}
