'use client'

import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { Button, Chip, Field, Input, Modal, Select, api, cx } from '@/components/ui'
import { composeTemplates, missingMedia, type MissingMedia } from '@/engine/compose'
import { OCCASION_INFO, PALETTE_INFO } from '@/lib/catalog'
import { OCCASIONS, PALETTES, type Occasion, type Palette } from '@/lib/schemas'
import { BLANK, TEMPLATES, templateById, type Template } from '@/templates/library'

const Player = dynamic(() => import('@/engine/player/Player').then((m) => m.Player), { ssr: false })
const KIND_EMOJI: Record<string, string> = { opening: '🎬', content: '📄', game: '🎲', media: '📸', finale: '💝' }
const SAMPLE = { to: 'Alex', from: 'Sam' }
const CATEGORIES = ['All', ...new Set(TEMPLATES.map((t) => t.category))]

const needs = (m: MissingMedia[]) => {
  const n = (k: MissingMedia['kind']) => m.filter((x) => x.kind === k).length
  return [n('image') && `${n('image')} photo${n('image') > 1 ? 's' : ''}`, n('audio') && `${n('audio')} audio`, n('video') && `${n('video')} video`].filter(Boolean).join(' · ')
}
// Cheap to compute once: the media each template asks for, shown on its card.
const NEEDS = Object.fromEntries(TEMPLATES.map((t) => [t.id, needs(missingMedia(composeTemplates([t.id], SAMPLE).doc))]))

export function TemplateGallery() {
  const [cat, setCat] = useState('All')
  const [picked, setPicked] = useState<string[]>([])
  const [preview, setPreview] = useState<Template | null>(null)
  const [setup, setSetup] = useState(false)
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))
  const move = (i: number, d: number) => setPicked((p) => { const c = [...p]; [c[i], c[i + d]] = [c[i + d], c[i]]; return c })

  return (
    <div className="mx-auto max-w-6xl px-5 pb-40">
      <h1 className="font-display text-4xl sm:text-5xl">Start from a template</h1>
      <p className="mt-2 text-ink-soft max-w-2xl">Pick one — or combine several. We merge their scenes into one surprise with a single opening and finale, and you can reorder or remove anything afterwards.</p>

      <div className="flex flex-wrap gap-2 mt-6" role="tablist" aria-label="Category">
        {CATEGORIES.map((c) => (
          <button key={c} role="tab" aria-selected={cat === c} onClick={() => setCat(c)} className={cx('h-9 px-4 rounded-full text-sm font-semibold ring-1', cat === c ? 'bg-ink text-white ring-ink' : 'bg-white ring-line hover:ring-ink/30')}>{c}</button>
        ))}
      </div>

      <button onClick={() => { setPicked([BLANK.id]); setSetup(true) }} className="mt-6 w-full sm:w-auto rounded-2xl border-2 border-dashed border-line bg-white/60 px-5 py-3 text-left hover:border-ink/30">
        <span className="font-semibold">✨ Start from a blank canvas</span> <span className="text-sm text-ink-soft">— an opening and a finale; add the rest yourself</span>
      </button>

      <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mt-6">
        {TEMPLATES.filter((t) => cat === 'All' || t.category === cat).map((t) => {
          const n = picked.indexOf(t.id) + 1
          return (
            <li key={t.id} className={cx('rounded-[1.75rem] bg-white ring-1 overflow-hidden flex flex-col transition', n ? 'ring-2 ring-rose' : 'ring-line')}>
              <div className="relative p-5 h-36 flex flex-col justify-between" style={{ background: PALETTE_INFO[t.palette].swatch }}>
                <span className="text-5xl drop-shadow-sm" aria-hidden>{t.emoji}</span>
                <div className="flex gap-1 flex-wrap" aria-label={`${t.scenes.length} scenes`}>
                  {t.scenes.map((s, i) => <span key={i} title={s.title} className="text-xs bg-white/80 rounded-full px-2 py-0.5">{KIND_EMOJI[s.kind]} {s.title}</span>)}
                </div>
                {n > 0 && <span className="absolute top-4 right-4 size-8 grid place-items-center rounded-full bg-rose text-white font-bold">{n}</span>}
              </div>
              <div className="p-5 flex-1 flex flex-col">
                <div className="flex items-center gap-2"><h2 className="font-semibold text-lg">{t.name}</h2><Chip>{t.category}</Chip></div>
                <p className="text-sm text-ink-soft mt-1 flex-1">{t.description}</p>
                <p className="text-xs text-ink-soft mt-3">For: {t.occasions.map((o) => OCCASION_INFO[o].label).join(', ')}</p>
                {NEEDS[t.id] && <p className="text-xs text-ink-soft mt-1">You’ll add: {NEEDS[t.id]}</p>}
                <div className="flex gap-2 mt-4">
                  <Button size="sm" variant="secondary" onClick={() => setPreview(t)}>Preview</Button>
                  <Button size="sm" variant={n ? 'danger' : 'primary'} onClick={() => toggle(t.id)} aria-pressed={n > 0}>{n ? 'Remove' : picked.length ? '+ Combine' : 'Use this'}</Button>
                </div>
              </div>
            </li>
          )
        })}
      </ul>

      {picked.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 p-4">
          <div className="mx-auto max-w-4xl rounded-[1.75rem] bg-ink text-white p-4 shadow-[var(--shadow-lift)] flex flex-col sm:flex-row sm:items-center gap-3">
            <ol className="flex flex-wrap gap-2 flex-1" aria-label="Templates in order">
              {picked.map((id, i) => (
                <li key={id} className="flex items-center gap-1 rounded-full bg-white/10 pl-3 pr-1 py-1 text-sm">
                  {i + 1}. {templateById(id)!.emoji} {templateById(id)!.name}
                  <button className="size-6 rounded-full hover:bg-white/15 disabled:opacity-30" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move earlier">←</button>
                  <button className="size-6 rounded-full hover:bg-white/15 disabled:opacity-30" disabled={i === picked.length - 1} onClick={() => move(i, 1)} aria-label="Move later">→</button>
                  <button className="size-6 rounded-full hover:bg-white/15" onClick={() => toggle(id)} aria-label={`Remove ${templateById(id)!.name}`}>×</button>
                </li>
              ))}
            </ol>
            <Button onClick={() => setSetup(true)}>{picked.length > 1 ? `Combine ${picked.length} →` : 'Continue →'}</Button>
          </div>
        </div>
      )}

      <Modal open={!!preview} onClose={() => setPreview(null)} title={preview ? `${preview.emoji} ${preview.name}` : ''}>
        {preview && (
          <>
            <div className="rounded-[1.5rem] ring-4 ring-ink overflow-hidden h-[min(640px,72dvh)] overflow-y-auto overscroll-contain">
              <div className="[zoom:0.75]"><Player key={preview.id} doc={composeTemplates([preview.id], SAMPLE).doc} photo={() => null} preview /></div>
            </div>
            <p className="text-xs text-ink-soft mt-3">Sample names shown. Personalise it with: {preview.customize.join(', ')}.</p>
          </>
        )}
      </Modal>

      {setup && <SetupModal ids={picked} onClose={() => { setSetup(false); setPicked((p) => p.filter((x) => x !== BLANK.id)) }} />}
    </div>
  )
}

function SetupModal({ ids, onClose }: { ids: string[]; onClose: () => void }) {
  const router = useRouter()
  const ts = ids.map((id) => templateById(id)!)
  const [f, setF] = useState({ recipientName: '', creatorName: '', occasion: (ts[0].occasions[0] ?? 'just_because') as Occasion, palette: ts[0].palette as Palette, keepTemplateColours: false, openingFrom: ts[0].id, finaleFrom: ts[0].id })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = (p: Partial<typeof f>) => setF((x) => ({ ...x, ...p }))

  // Same composition the server runs, for the summary only; the server result is what gets saved.
  const summary = useMemo(() => {
    try {
      const { doc, skipped } = composeTemplates(ids, { ...f, to: f.recipientName, from: f.creatorName })
      return { scenes: doc.scenes.length, skipped: skipped.length, needs: needs(missingMedia(doc)) }
    } catch (e) {
      return { error: (e as Error).message }
    }
  }, [ids, f])

  const create = async () => {
    setBusy(true)
    setError(null)
    try {
      const { id } = await api<{ id: string }>('/api/templates', { body: { templateIds: ids, ...f } })
      router.push(`/studio/${id}?fresh=template`)
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }

  return (
    <Modal open onClose={onClose} title={ids.length > 1 ? 'Combine into one surprise' : 'Make it yours'}>
      <div className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Who is it for?">{(id) => <Input id={id} value={f.recipientName} maxLength={60} onChange={(e) => set({ recipientName: e.target.value })} placeholder="Their name" />}</Field>
          <Field label="From">{(id) => <Input id={id} value={f.creatorName} maxLength={60} onChange={(e) => set({ creatorName: e.target.value })} placeholder="Your name" />}</Field>
        </div>
        <Field label="Occasion">{(id) => <Select id={id} value={f.occasion} onChange={(e) => set({ occasion: e.target.value as Occasion })}>{OCCASIONS.map((o) => <option key={o} value={o}>{OCCASION_INFO[o].label}</option>)}</Select>}</Field>
        <div>
          <p className="text-sm font-semibold mb-2">Overall colours</p>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Overall colours">
            {PALETTES.map((p) => (
              <button key={p} role="radio" aria-checked={f.palette === p} aria-label={PALETTE_INFO[p].label} title={PALETTE_INFO[p].label} onClick={() => set({ palette: p })} className={cx('size-9 rounded-xl ring-2 ring-offset-1', f.palette === p ? 'ring-ink' : 'ring-transparent')} style={{ background: PALETTE_INFO[p].swatch }} />
            ))}
          </div>
          {ids.length > 1 && (
            <label className="flex items-center gap-2 text-sm mt-3"><input type="checkbox" checked={f.keepTemplateColours} onChange={(e) => set({ keepTemplateColours: e.target.checked })} className="size-4" /> Keep each template’s own colours where they fit</label>
          )}
        </div>
        {ids.length > 1 && (
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Opening from">{(id) => <Select id={id} value={f.openingFrom} onChange={(e) => set({ openingFrom: e.target.value })}>{ts.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Select>}</Field>
            <Field label="Finale from">{(id) => <Select id={id} value={f.finaleFrom} onChange={(e) => set({ finaleFrom: e.target.value })}>{ts.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Select>}</Field>
          </div>
        )}
        <p className="text-sm rounded-2xl bg-cream p-3" aria-live="polite">
          {'error' in summary ? summary.error : <>
            {summary.scenes} scenes{summary.skipped ? ` (${summary.skipped} extra opening/finale scenes left out)` : ''}.
            {summary.needs ? ` You’ll add: ${summary.needs}.` : ''}
          </>}
        </p>
        {error && <p className="text-sm text-rose-deep" role="alert">{error}</p>}
        <Button className="w-full" size="lg" loading={busy} disabled={!f.recipientName.trim() || !f.creatorName.trim() || 'error' in summary} onClick={create}>Create my surprise</Button>
      </div>
    </Modal>
  )
}
