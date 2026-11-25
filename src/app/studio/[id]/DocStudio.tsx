'use client'

import { useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { BlockForm, IconBtn } from '@/components/BlockForm'
import { Button, Card, Chip, Modal, Select, api, cx, useToast } from '@/components/ui'
import { BLOCKS, BLOCK_TYPES, type BlockType } from '@/engine/blocks'
import { missingMedia } from '@/engine/compose'
import { SCENE_KINDS, TRANSITIONS, type SurpriseDoc } from '@/engine/doc'
import * as ops from '@/engine/ops'
import { Player } from '@/engine/player/Player'
import { PALETTE_INFO } from '@/lib/catalog'
import { MOTION, PALETTES } from '@/lib/schemas'
import { TEMPLATES } from '@/templates/library'
import { SharePanel } from './SharePanel'
import type { EditorSurprise } from './StudioEditor'

const KIND_EMOJI: Record<string, string> = { opening: '🎬', content: '📄', game: '🎲', media: '📸', finale: '💝' }
const CATEGORIES = [['text', 'Text'], ['image', 'Photos'], ['media', 'Audio & video'], ['interactive', 'Interactive'], ['decor', 'Decoration']] as const
const AUTOSAVE_MS = 1500

/** Editor for scene documents: scenes, blocks, theme, autosave, undo/redo and a live preview. */
export function DocStudio({ initial, initialDoc, isGuest }: { initial: EditorSurprise; initialDoc: SurpriseDoc; isGuest: boolean }) {
  const toast = useToast()
  const params = useSearchParams()
  const [s, setS] = useState(initial)
  const [doc, setDoc] = useState(initialDoc)
  // History lives in refs so fast repeated undo/redo never reads a stale stack; `hist` mirrors the sizes for render.
  const past = useRef<SurpriseDoc[]>([])
  const future = useRef<SurpriseDoc[]>([])
  const [hist, setHist] = useState({ past: 0, future: 0 })
  const syncHist = () => setHist({ past: past.current.length, future: future.current.length })
  const [sel, setSel] = useState(initialDoc.scenes[0].id)
  const [tab, setTab] = useState<'edit' | 'share'>(params.get('tab') === 'share' ? 'share' : 'edit')
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'unsaved' | 'error'>('saved')
  const [adding, setAdding] = useState(false)
  const [previewKey, setPreviewKey] = useState(0)
  const [inserting, setInserting] = useState<'closed' | 'open' | string>('closed') // template id while busy
  const latest = useRef(doc)

  useEffect(() => {
    if (params.get('fresh')) toast(params.get('fresh') === 'template' ? 'Your surprise is ready — swap in your own words and media ✨' : 'Your first draft is ready — make it yours ✨', 'good')
  }, [params, toast])

  /** Every change goes through an engine operation; invalid results are refused with a message. */
  const apply = useCallback(
    (fn: (d: SurpriseDoc) => SurpriseDoc) => {
      try {
        const next = fn(latest.current)
        past.current = [...past.current.slice(-49), latest.current]
        future.current = []
        syncHist()
        latest.current = next
        setDoc(next)
        setSaveState('unsaved')
      } catch (e) {
        toast((e as Error).message.slice(0, 160), 'bad')
      }
    },
    [toast],
  )
  const undo = () => {
    const prev = past.current.at(-1)
    if (!prev) return
    future.current = [latest.current, ...future.current]
    past.current = past.current.slice(0, -1)
    syncHist()
    latest.current = prev
    setDoc(prev)
    setSaveState('unsaved')
  }
  const redo = () => {
    const next = future.current[0]
    if (!next) return
    past.current = [...past.current, latest.current]
    future.current = future.current.slice(1)
    syncHist()
    latest.current = next
    setDoc(next)
    setSaveState('unsaved')
  }

  const save = useCallback(
    async (source: 'manual' | 'autosave' = 'manual') => {
      setSaveState('saving')
      try {
        await api(`/api/surprises/${s.id}/doc`, { method: 'PUT', body: { doc: latest.current, source } })
        setSaveState('saved')
        return true
      } catch (e) {
        setSaveState('error')
        toast((e as Error).message, 'bad')
        return false
      }
    },
    [s.id, toast],
  )

  // Autosave shortly after the last change.
  useEffect(() => {
    if (saveState !== 'unsaved') return
    const t = setTimeout(() => save('autosave'), AUTOSAVE_MS)
    return () => clearTimeout(t)
  }, [doc, saveState, save])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'z') return
      if ((e.target as HTMLElement).closest('input, textarea')) return // let fields undo their own typing
      e.preventDefault()
      if (e.shiftKey) redo()
      else undo()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const sceneIndex = Math.max(0, doc.scenes.findIndex((x) => x.id === sel))
  const scene = doc.scenes[sceneIndex]
  const missing = missingMedia(doc)

  /** Merging runs on the server; the result is applied like any edit, so it can be undone. */
  const insertTemplate = async (templateId: string) => {
    setInserting(templateId)
    try {
      const before = new Set(latest.current.scenes.map((x) => x.id))
      const r = await api<{ doc: SurpriseDoc; skipped: { scene: string }[] }>(`/api/surprises/${s.id}/insert-template`, { body: { doc: latest.current, templateId, at: sceneIndex + 1 } })
      apply(() => r.doc)
      const first = r.doc.scenes.find((x) => !before.has(x.id))
      if (first) { setSel(first.id); setPreviewKey((k) => k + 1) }
      toast(`Added ${r.doc.scenes.length - before.size} scene(s)${r.skipped.length ? ` — kept your own ${r.skipped.map((x) => x.scene.toLowerCase()).join(' and ')}` : ''}`, 'good')
      setInserting('closed')
    } catch (e) {
      toast((e as Error).message, 'bad')
      setInserting('open')
    }
  }

  return (
    <div className="mx-auto max-w-[1400px] px-5 pb-24">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <p className="text-sm font-semibold text-ink-soft flex items-center gap-2">
            {doc.scenes.length} scenes · for {s.recipientName}
            <Chip tone={s.status === 'PUBLISHED' ? 'good' : 'info'}>{s.status.toLowerCase()}</Chip>
          </p>
          <h1 className="font-display text-3xl sm:text-4xl mt-1">{s.title ?? 'Your surprise'}</h1>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-ink-soft" aria-live="polite">{{ saved: 'All changes saved', saving: 'Saving…', unsaved: 'Unsaved changes', error: 'Not saved' }[saveState]}</span>
          <Button variant="ghost" size="sm" onClick={undo} disabled={!hist.past} aria-label="Undo">↶ Undo</Button>
          <Button variant="ghost" size="sm" onClick={redo} disabled={!hist.future} aria-label="Redo">↷ Redo</Button>
        </div>
      </div>

      <div className="inline-flex rounded-full bg-white ring-1 ring-line p-1 mb-6" role="tablist">
        {(['edit', 'share'] as const).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={async () => { if (t === 'share' && saveState !== 'saved') await save(); setTab(t) }} className={cx('h-9 px-5 rounded-full text-sm font-semibold', tab === t ? 'bg-ink text-white' : 'text-ink-soft')}>
            {t === 'edit' ? 'Edit & preview' : 'Publish & share'}
          </button>
        ))}
      </div>

      <Modal open={inserting !== 'closed'} onClose={() => setInserting('closed')} title="Insert a template">
        <p className="text-sm text-ink-soft mb-4">Its scenes go after “{scene.title || 'this scene'}”. Your opening, finale and colours stay as they are.</p>
        <ul className="space-y-2 max-h-[60dvh] overflow-y-auto">
          {TEMPLATES.map((t) => (
            <li key={t.id}>
              <button disabled={inserting !== 'open'} onClick={() => insertTemplate(t.id)} className="w-full text-left rounded-2xl ring-1 ring-line p-3 hover:ring-rose disabled:opacity-50 flex gap-3 items-start">
                <span className="text-2xl" aria-hidden>{t.emoji}</span>
                <span><span className="font-semibold block">{t.name}{inserting === t.id ? ' — adding…' : ''}</span><span className="text-sm text-ink-soft">{t.description}</span></span>
              </button>
            </li>
          ))}
        </ul>
      </Modal>

      {tab === 'share' ? (
        <SharePanel s={s} setS={setS} dirty={saveState !== 'saved'} save={() => save()} isGuest={isGuest} />
      ) : (
        <div className="grid lg:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[240px_minmax(0,1fr)_400px] gap-6 items-start">
          {/* Scenes */}
          <aside className="space-y-3 lg:sticky lg:top-6">
            <h2 className="text-xs font-bold uppercase tracking-widest text-ink-soft">Scenes</h2>
            <ol className="space-y-2">
              {doc.scenes.map((sc, i) => (
                <li key={sc.id}>
                  <div className={cx('rounded-2xl ring-1 bg-white px-3 py-2.5 transition', sc.id === sel ? 'ring-2 ring-rose' : 'ring-line')}>
                    <button onClick={() => { setSel(sc.id); setPreviewKey((k) => k + 1) }} className="w-full text-left">
                      <span className="text-xs text-ink-soft">{i + 1} · {KIND_EMOJI[sc.kind]} {sc.kind}{sc.unlockAt ? ' · 🔒' : ''}</span>
                      <span className="block font-semibold truncate">{sc.title || 'Untitled scene'}</span>
                    </button>
                    {sc.id === sel && (
                      <div className="flex gap-0.5 mt-1 -ml-1">
                        <IconBtn label="Move scene up" disabled={i === 0} onClick={() => apply((d) => ops.moveScene(d, sc.id, i - 1))}>↑</IconBtn>
                        <IconBtn label="Move scene down" disabled={i === doc.scenes.length - 1} onClick={() => apply((d) => ops.moveScene(d, sc.id, i + 1))}>↓</IconBtn>
                        <IconBtn label="Duplicate scene" onClick={() => apply((d) => ops.duplicateScene(d, sc.id))}>⧉</IconBtn>
                        <IconBtn label="Delete scene" disabled={doc.scenes.length === 1} onClick={() => confirm('Delete this scene?') && (apply((d) => ops.removeScene(d, sc.id)), setSel(doc.scenes[Math.max(0, i - 1)].id))}>🗑</IconBtn>
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ol>
            <Button variant="secondary" size="sm" className="w-full" onClick={() => apply((d) => ops.addScene(d, { kind: 'content', title: 'New scene', blocks: [ops.newBlock('heading')] }, sceneIndex + 1))}>+ Add scene</Button>
            <Button variant="ghost" size="sm" className="w-full" onClick={() => setInserting('open')}>+ Insert a template</Button>
            {missing.length > 0 && (
              <Card className="p-4">
                <h3 className="text-xs font-bold uppercase tracking-widest text-ink-soft mb-2">Still to add</h3>
                <ul className="space-y-1 max-h-48 overflow-y-auto">
                  {missing.map((m, i) => (
                    <li key={i}><button onClick={() => { setSel(m.sceneId); setPreviewKey((k) => k + 1) }} className="text-left text-sm hover:text-rose w-full truncate">{m.kind === 'image' ? '📸' : m.kind === 'audio' ? '🎵' : '🎬'} {m.scene || 'Untitled'} · {m.block}</button></li>
                  ))}
                </ul>
              </Card>
            )}
            <Card className="p-4 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-widest text-ink-soft">Whole surprise</h3>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Palette">
                {PALETTES.map((p) => (
                  <button key={p} role="radio" aria-checked={doc.theme.palette === p} aria-label={PALETTE_INFO[p].label} title={PALETTE_INFO[p].label} onClick={() => apply((d) => ops.setTheme(d, { palette: p }))} className={cx('size-8 rounded-xl ring-2 ring-offset-1', doc.theme.palette === p ? 'ring-ink' : 'ring-transparent')} style={{ background: PALETTE_INFO[p].swatch }} />
                ))}
              </div>
              <Select value={doc.theme.motion} onChange={(e) => apply((d) => ops.setTheme(d, { motion: e.target.value as SurpriseDoc['theme']['motion'] }))} aria-label="Animation" className="py-2 text-sm">
                {MOTION.map((m) => <option key={m} value={m}>Animation: {m}</option>)}
              </Select>
            </Card>
          </aside>

          {/* Selected scene */}
          <section className="space-y-4 min-w-0">
            <Card className="p-5 grid sm:grid-cols-2 gap-3">
              <label className="block sm:col-span-2"><span className="block text-xs font-semibold text-ink-soft mb-1">Scene title</span>
                <input value={scene.title} maxLength={120} onChange={(e) => apply((d) => ops.updateScene(d, scene.id, { title: e.target.value }))} className="w-full rounded-2xl bg-white px-4 py-2 ring-1 ring-line outline-none focus:ring-2 focus:ring-rose/60" />
              </label>
              <label className="block"><span className="block text-xs font-semibold text-ink-soft mb-1">Kind</span>
                <Select value={scene.kind} onChange={(e) => apply((d) => ops.updateScene(d, scene.id, { kind: e.target.value as typeof scene.kind }))} className="py-2">{SCENE_KINDS.map((k) => <option key={k}>{k}</option>)}</Select>
              </label>
              <label className="block"><span className="block text-xs font-semibold text-ink-soft mb-1">Transition in</span>
                <Select value={scene.transition} onChange={(e) => apply((d) => ops.updateScene(d, scene.id, { transition: e.target.value as typeof scene.transition }))} className="py-2">{TRANSITIONS.map((k) => <option key={k}>{k}</option>)}</Select>
              </label>
              <label className="block"><span className="block text-xs font-semibold text-ink-soft mb-1">Colours for this scene</span>
                <Select value={scene.palette ?? ''} onChange={(e) => apply((d) => ops.updateScene(d, scene.id, { palette: (e.target.value || undefined) as typeof scene.palette }))} className="py-2">
                  <option value="">Same as the surprise</option>
                  {PALETTES.map((p) => <option key={p} value={p}>{PALETTE_INFO[p].label}</option>)}
                </Select>
              </label>
              <label className="block"><span className="block text-xs font-semibold text-ink-soft mb-1">Lock until (optional)</span>
                <input type="datetime-local" value={scene.unlockAt ? new Date(new Date(scene.unlockAt).getTime() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 16) : ''} onChange={(e) => apply((d) => ops.updateScene(d, scene.id, { unlockAt: e.target.value ? new Date(e.target.value).toISOString() : undefined }))} className="w-full rounded-2xl bg-white px-4 py-2 ring-1 ring-line" />
              </label>
            </Card>

            {scene.blocks.map((b, i) => (
              <Card key={b.id} className="p-5">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <h3 className="font-semibold">{BLOCKS[b.type].emoji} {BLOCKS[b.type].label}</h3>
                  <span className="flex gap-0.5">
                    <IconBtn label="Move block up" disabled={i === 0} onClick={() => apply((d) => ops.moveBlock(d, scene.id, b.id, i - 1))}>↑</IconBtn>
                    <IconBtn label="Move block down" disabled={i === scene.blocks.length - 1} onClick={() => apply((d) => ops.moveBlock(d, scene.id, b.id, i + 1))}>↓</IconBtn>
                    <IconBtn label="Duplicate block" onClick={() => apply((d) => ops.duplicateBlock(d, scene.id, b.id))}>⧉</IconBtn>
                    <IconBtn label="Delete block" onClick={() => confirm(`Delete this ${BLOCKS[b.type].label.toLowerCase()}?`) && apply((d) => ops.removeBlock(d, scene.id, b.id))}>🗑</IconBtn>
                  </span>
                </div>
                <BlockForm type={b.type} value={b.props} surpriseId={s.id} onChange={(props) => apply((d) => ops.updateBlockProps(d, scene.id, b.id, props))} />
              </Card>
            ))}

            {adding ? (
              <Card className="p-5">
                <div className="flex justify-between items-center mb-3"><h3 className="font-semibold">Add a block</h3><IconBtn label="Close" onClick={() => setAdding(false)}>×</IconBtn></div>
                {CATEGORIES.map(([cat, label]) => (
                  <div key={cat} className="mb-3">
                    <p className="text-xs font-bold uppercase tracking-widest text-ink-soft mb-2">{label}</p>
                    <div className="flex flex-wrap gap-2">
                      {BLOCK_TYPES.filter((t) => BLOCKS[t].category === cat).map((t: BlockType) => (
                        <button key={t} onClick={() => { apply((d) => ops.addBlock(d, scene.id, ops.newBlock(t))); setAdding(false) }} className="h-10 px-4 rounded-full bg-white ring-1 ring-line text-sm font-semibold hover:ring-ink/30">{BLOCKS[t].emoji} {BLOCKS[t].label}</button>
                      ))}
                    </div>
                  </div>
                ))}
              </Card>
            ) : (
              <Button variant="secondary" onClick={() => setAdding(true)} disabled={scene.blocks.length >= 20}>+ Add block</Button>
            )}
          </section>

          {/* Preview */}
          <aside className="lg:col-span-2 xl:col-span-1 xl:sticky xl:top-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-ink-soft">Preview · scene {sceneIndex + 1}</p>
              <button onClick={() => setPreviewKey((k) => k + 1)} className="text-sm font-semibold text-rose">Restart scene</button>
            </div>
            <div className="rounded-[2rem] ring-8 ring-ink shadow-[var(--shadow-lift)] overflow-hidden max-h-[78dvh] overflow-y-auto">
              <Player key={`${previewKey}-${sel}`} doc={doc} startAt={sceneIndex} photo={(id) => (id ? `/api/uploads/${id}` : null)} preview />
            </div>
          </aside>
        </div>
      )}
    </div>
  )
}
