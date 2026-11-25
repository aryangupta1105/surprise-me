'use client'

import { AnimatePresence, motion } from 'framer-motion'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { Button, Card, ErrorState, Field, Input, ListInput, Select, Textarea, api, cx, useToast } from '@/components/ui'
import { EXPERIENCE_INFO, OCCASION_INFO, PALETTE_INFO, TONE_LABELS } from '@/lib/catalog'
import { EXPERIENCES, OCCASIONS, PALETTES, TONES, type ExperienceType } from '@/lib/schemas'
import { uploadMedia } from '@/lib/upload-client'
import type { Brief } from '@/server/quick'

const LS_KEY = 'sm:quick'
const EXAMPLES = [
  'A birthday surprise for my best friend Riya. Friends for five years, she loves photography, music and travelling. Make it funny but emotional.',
  'Anniversary surprise for my wife Sara from Dev. Remember our first trip to Udaipur when the boat broke down. Letters she can open later.',
  'A thank-you for my mentor Priya, who taught me to drink water before panicking. Warm, a little playful.',
]
const MAX_PHOTOS = 12
const LOADING = ['Reading your words…', 'Writing it in your voice…', 'Building the scenes…', 'Placing your photos…', 'Adding a little magic…']

type Photo = { file: File; url: string }
type Stage = 'describe' | 'reading' | 'review' | 'making'

export function QuickCreate() {
  const router = useRouter()
  const toast = useToast()
  const [description, setDescription] = useState('')
  const [brief, setBrief] = useState<Brief | null>(null)
  const [stage, setStage] = useState<Stage>('describe')
  const [photos, setPhotos] = useState<Photo[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loadingLine, setLoadingLine] = useState(0)
  const restored = useRef(false)

  // Keep the description and the reviewed brief across refreshes (photos stay in memory only).
  // Restored after mount on purpose: localStorage does not exist during server rendering.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(LS_KEY) ?? 'null')
      if (saved?.description) setDescription(saved.description)
      if (saved?.brief) {
        setBrief(saved.brief)
        setStage('review')
      }
    } catch {}
    restored.current = true
  }, [])
  /* eslint-enable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!restored.current) return
    try { localStorage.setItem(LS_KEY, JSON.stringify({ description, brief })) } catch {}
  }, [description, brief])
  useEffect(() => {
    if (stage !== 'reading' && stage !== 'making') return
    const t = setInterval(() => setLoadingLine((x) => (x + 1) % LOADING.length), 2400)
    return () => clearInterval(t)
  }, [stage])

  const addPhotos = (files: FileList | null) => {
    const picked = [...(files ?? [])].filter((f) => /^image\/(jpeg|png|webp|gif)$/.test(f.type))
    const tooBig = picked.filter((f) => f.size > 30 * 1024 * 1024)
    if (tooBig.length) toast(`${tooBig.length} photo(s) over 30 MB were skipped`, 'bad')
    setPhotos((p) => [...p, ...picked.filter((f) => f.size <= 30 * 1024 * 1024).map((file) => ({ file, url: URL.createObjectURL(file) }))].slice(0, MAX_PHOTOS))
  }

  const read = async () => {
    setError(null)
    setStage('reading')
    try {
      const { brief } = await api<{ brief: Brief }>('/api/quick/extract', { body: { description } })
      setBrief(brief)
      setStage('review')
    } catch (e) {
      setError((e as Error).message)
      setStage('describe')
    }
  }

  const make = async () => {
    if (!brief) return
    if (!brief.recipientName.trim() || !brief.creatorName.trim()) return setError('Add both names so we know who it’s for and who it’s from.')
    setError(null)
    setStage('making')
    try {
      const { id } = await api<{ id: string }>('/api/quick/start', { body: { brief } })
      const photoIds: string[] = []
      for (const p of photos) photoIds.push(await uploadMedia(p.file, id, 'image'))
      await api(`/api/surprises/${id}/compose`, { body: { experiences: brief.experiences, photoIds, palette: brief.palette } })
      try { localStorage.removeItem(LS_KEY) } catch {}
      router.push(`/studio/${id}?fresh=1`)
    } catch (e) {
      setError((e as Error).message)
      setStage('review')
    }
  }

  const set = <K extends keyof Brief>(k: K, v: Brief[K]) => setBrief((b) => (b ? { ...b, [k]: v } : b))
  const toggleExp = (e: ExperienceType) =>
    setBrief((b) => {
      if (!b) return b
      const has = b.experiences.includes(e)
      if (has && b.experiences.length === 1) return b
      if (!has && b.experiences.length >= 3) return b
      return { ...b, experiences: has ? b.experiences.filter((x) => x !== e) : [...b.experiences, e] }
    })

  return (
    <div className="mx-auto max-w-3xl px-5 pb-24">
      <AnimatePresence mode="wait">
        {(stage === 'reading' || stage === 'making') && (
          <motion.section key="busy" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center py-20" aria-live="polite">
            <motion.div animate={{ rotate: [0, -8, 8, -4, 0], y: [0, -8, 0] }} transition={{ repeat: Infinity, duration: 1.8 }} className="text-8xl inline-block" aria-hidden>{stage === 'reading' ? '🔍' : '🎁'}</motion.div>
            <h1 className="font-display text-4xl mt-8">{stage === 'reading' ? 'Reading your description…' : `Making something for ${brief?.recipientName}…`}</h1>
            <p className="font-hand text-2xl text-ink-soft mt-4">{LOADING[loadingLine]}</p>
            <p className="text-sm text-ink-soft mt-10">{stage === 'reading' ? 'A few seconds.' : 'Usually 15–40 seconds. You can change everything afterwards.'}</p>
          </motion.section>
        )}

        {stage === 'describe' && (
          <motion.section key="describe" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}>
            <h1 className="font-display text-4xl sm:text-6xl leading-[1] text-balance">Tell us about the surprise.</h1>
            <p className="text-ink-soft text-lg mt-4">Who it’s for, the occasion, a memory or two, the feeling you want. One sentence works; more makes it more <em>them</em>.</p>
            <Card className="mt-8 p-2">
              <label htmlFor="describe" className="sr-only">Describe the surprise</label>
              <textarea
                id="describe"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={7}
                maxLength={3000}
                autoFocus
                placeholder={EXAMPLES[0]}
                className="w-full resize-none rounded-[1.25rem] bg-transparent p-5 text-lg leading-relaxed outline-none placeholder:text-ink-soft/50"
              />
              <div className="flex flex-wrap items-center gap-3 border-t border-line p-3">
                <label className="inline-flex h-10 items-center gap-2 px-4 rounded-full bg-cream text-sm font-semibold cursor-pointer hover:bg-blush/50">
                  📸 Add photos <span className="font-normal text-ink-soft">optional</span>
                  <input type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif" className="sr-only" onChange={(e) => addPhotos(e.target.files)} />
                </label>
                <span className="text-xs text-ink-soft ml-auto">{description.length}/3000</span>
                <Button onClick={read} disabled={description.trim().length < 15} size="lg">Continue ✨</Button>
              </div>
            </Card>
            <PhotoStrip photos={photos} onRemove={(i) => setPhotos((p) => p.filter((_, j) => j !== i))} />
            {error && <div className="mt-5"><ErrorState message={error} /></div>}
            <div className="mt-8">
              <p className="text-sm font-semibold text-ink-soft mb-3">Need a start? Tap one:</p>
              <div className="grid gap-2">
                {EXAMPLES.map((x) => (
                  <button key={x} onClick={() => setDescription(x)} className="text-left rounded-2xl bg-white/70 ring-1 ring-line px-4 py-3 text-sm hover:ring-ink/30">{x}</button>
                ))}
              </div>
            </div>
            <p className="mt-10 text-sm text-ink-soft">Prefer to answer questions step by step? <Link href="/create/guided" className="font-semibold text-rose">Use Guided create →</Link> · Or <Link href="/templates" className="font-semibold text-rose">start from a template →</Link></p>
          </motion.section>
        )}

        {stage === 'review' && brief && (
          <motion.section key="review" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}>
            <h1 className="font-display text-4xl sm:text-5xl">Here’s what we understood</h1>
            <p className="text-ink-soft text-lg mt-3">Fix anything that’s off — we only use what you tell us, and never make up memories.</p>

            <Card className="mt-8 p-6 sm:p-8 grid sm:grid-cols-2 gap-5">
              <Field label="It’s for">{(id) => <Input id={id} value={brief.recipientName} onChange={(e) => set('recipientName', e.target.value)} placeholder="Their name" maxLength={60} />}</Field>
              <Field label="From" hint={brief.creatorName ? undefined : 'Your name — so they know who made it.'}>{(id) => <Input id={id} value={brief.creatorName} onChange={(e) => set('creatorName', e.target.value)} placeholder="Your name" maxLength={60} autoFocus={!brief.creatorName} />}</Field>
              <Field label="Occasion">
                {(id) => <Select id={id} value={brief.occasion} onChange={(e) => set('occasion', e.target.value as Brief['occasion'])}>{OCCASIONS.map((o) => <option key={o} value={o}>{OCCASION_INFO[o].emoji} {OCCASION_INFO[o].label}</option>)}</Select>}
              </Field>
              <Field label="Who they are to you" optional>{(id) => <Input id={id} value={brief.relationship} onChange={(e) => set('relationship', e.target.value)} maxLength={80} />}</Field>
              <div className="sm:col-span-2">
                <Field label="Things they love" optional>{(id) => <Input id={id} value={brief.interests || brief.loves} onChange={(e) => { set('interests', e.target.value); set('loves', '') }} maxLength={400} />}</Field>
              </div>
            </Card>

            <h2 className="font-semibold mt-8 mb-3">Feeling</h2>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Tone">
              {TONES.map((t) => (
                <button key={t} role="radio" aria-checked={brief.tone === t} onClick={() => set('tone', t)} className={cx('h-10 px-4 rounded-full text-sm font-semibold ring-1', brief.tone === t ? 'bg-ink text-white ring-ink' : 'bg-white ring-line')}>{TONE_LABELS[t]}</button>
              ))}
            </div>

            <h2 className="font-semibold mt-8 mb-1">What’s inside <span className="font-normal text-ink-soft text-sm">pick 1–3</span></h2>
            <p className="text-sm text-ink-soft mb-3">Each becomes its own scene. You can add more scenes later.</p>
            <div className="grid sm:grid-cols-2 gap-3">
              {EXPERIENCES.map((e) => {
                const on = brief.experiences.includes(e)
                return (
                  <button key={e} aria-pressed={on} onClick={() => toggleExp(e)} className={cx('text-left rounded-2xl bg-white p-4 ring-2 transition', on ? 'ring-rose' : 'ring-transparent opacity-80 hover:opacity-100')}>
                    <span className="font-semibold">{EXPERIENCE_INFO[e].emoji} {EXPERIENCE_INFO[e].label}</span>
                    <span className="block text-sm text-ink-soft mt-0.5">{EXPERIENCE_INFO[e].blurb}</span>
                  </button>
                )
              })}
            </div>
            {brief.experiences.includes('memory_journey') && !brief.memories.length && (
              <p className="text-sm text-[#8a5a00] mt-3">The memory timeline needs at least one memory — add one below, or pick another experience.</p>
            )}

            <Card className="mt-8 p-6 sm:p-8 space-y-6">
              <Field label="Shared memories" optional hint="One per box. These are the only memories we’ll use.">
                {() => <ListInput values={brief.memories} onChange={(v) => set('memories', v)} placeholder="A moment only you two share…" max={10} multiline />}
              </Field>
              <Field label="Inside jokes" optional>{() => <ListInput values={brief.insideJokes} onChange={(v) => set('insideJokes', v)} placeholder="“one more episode”" max={8} />}</Field>
              <Field label="Your own message" optional hint="Kept word for word as the final letter.">
                {(id) => <Textarea id={id} rows={4} value={brief.personalMessage} onChange={(e) => set('personalMessage', e.target.value)} maxLength={1200} />}
              </Field>
            </Card>

            <h2 className="font-semibold mt-8 mb-3">Colours</h2>
            <div className="flex flex-wrap gap-3" role="radiogroup" aria-label="Colour palette">
              {PALETTES.map((p) => (
                <button key={p} role="radio" aria-checked={brief.palette === p} onClick={() => set('palette', p)} className="flex flex-col items-center gap-1.5">
                  <span className={cx('size-12 rounded-2xl ring-2 ring-offset-2', brief.palette === p ? 'ring-ink' : 'ring-transparent')} style={{ background: PALETTE_INFO[p].swatch }} />
                  <span className="text-xs font-semibold">{PALETTE_INFO[p].label}</span>
                </button>
              ))}
            </div>

            <Card className="mt-8 p-6">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="font-semibold mr-auto">Photos <span className="font-normal text-ink-soft text-sm">optional · up to {MAX_PHOTOS}</span></h2>
                <label className="inline-flex h-10 items-center px-4 rounded-full bg-cream text-sm font-semibold cursor-pointer hover:bg-blush/50">
                  + Add photos
                  <input type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif" className="sr-only" onChange={(e) => addPhotos(e.target.files)} />
                </label>
              </div>
              {brief.wantsPhotos && !photos.length && <p className="text-sm text-ink-soft mt-2">You mentioned pictures — add them here and we’ll make a gallery scene.</p>}
              {(brief.wantsVoice || brief.wantsVideo) && (
                <p className="text-sm text-[#8a5a00] mt-2">Once it’s made, add your voice note or video in the editor: Add block → Audio & video.</p>
              )}
              <PhotoStrip photos={photos} onRemove={(i) => setPhotos((p) => p.filter((_, j) => j !== i))} />
            </Card>

            {error && <div className="mt-6"><ErrorState message={error} /></div>}
            <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
              <Button variant="ghost" onClick={() => setStage('describe')}>← Edit description</Button>
              <Button size="lg" onClick={make}>Create my surprise ✨</Button>
            </div>
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  )
}

function PhotoStrip({ photos, onRemove }: { photos: Photo[]; onRemove: (i: number) => void }) {
  if (!photos.length) return null
  return (
    <ul className="mt-4 flex flex-wrap gap-3">
      {photos.map((p, i) => (
        <li key={p.url} className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element -- local preview (blob URL) */}
          <img src={p.url} alt="" className="size-20 rounded-xl object-cover ring-1 ring-line" />
          <button onClick={() => onRemove(i)} className="absolute -top-2 -right-2 size-6 rounded-full bg-ink text-white text-xs" aria-label="Remove photo">×</button>
        </li>
      ))}
    </ul>
  )
}
