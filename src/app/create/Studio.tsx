'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { Button, Card, ErrorState, Spinner, Field, Input, ListInput, Select, Textarea, api, cx, useToast } from '@/components/ui'
import { EXPERIENCE_INFO, OCCASION_INFO, TONE_LABELS } from '@/lib/catalog'
import { EXPERIENCES, OCCASIONS, TONES, type ExperienceType, type Occasion, type StudioInput } from '@/lib/schemas'

type Draft = Omit<StudioInput, 'experienceType'> & { experienceType?: ExperienceType }
const EMPTY: Draft = {
  occasion: 'birthday', customOccasion: '', recipientName: '', creatorName: '', relationship: '', personality: '', interests: '', loves: '',
  language: 'English', tone: 'mixed', memories: [], insideJokes: [], importantDates: [], specialPhrases: [], appreciation: '', personalMessage: '', difficulty: 'medium',
}
const STEPS = ['Occasion', 'About them', 'Memories', 'Experience', 'Magic'] as const
const LS_KEY = 'sm:studio'

const clean = (d: Draft): Draft => ({
  ...d,
  memories: d.memories.map((s) => s.trim()).filter(Boolean),
  insideJokes: d.insideJokes.map((s) => s.trim()).filter(Boolean),
  importantDates: d.importantDates.map((s) => s.trim()).filter(Boolean),
  specialPhrases: d.specialPhrases.map((s) => s.trim()).filter(Boolean),
})

const LOADING_LINES = ['Reading your memories…', 'Finding the inside jokes…', 'Choosing the right words…', 'Sprinkling a little magic…', 'Wrapping it up with a bow…']

export function Studio() {
  const router = useRouter()
  const params = useSearchParams()
  const toast = useToast()
  const [d, setD] = useState<Draft>(EMPTY)
  const [step, setStep] = useState(0)
  const [draftId, setDraftId] = useState<string | null>(params.get('d'))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [genError, setGenError] = useState<string | null>(null)
  const loaded = useRef(false)
  const [ready, setReady] = useState(!params.get('d'))

  // Restore: server draft if the URL names one, else the local copy (guest refresh keeps everything).
  useEffect(() => {
    const id = params.get('d')
    ;(async () => {
      try {
        if (id) {
          const { surprise } = await api<{ surprise: { input: Draft } }>(`/api/surprises/${id}`)
          setD({ ...EMPTY, ...surprise.input })
          const saved = JSON.parse(localStorage.getItem(LS_KEY) ?? '{}')
          setStep(saved.draftId === id ? Math.min(saved.step ?? 1, 3) : 1)
        } else {
          const saved = JSON.parse(localStorage.getItem(LS_KEY) ?? 'null')
          const exp = params.get('exp') as ExperienceType | null
          if (exp && (EXPERIENCES as readonly string[]).includes(exp)) setD((x) => ({ ...x, experienceType: exp }))
          else if (saved?.d && !saved.draftId) {
            setD({ ...EMPTY, ...saved.d })
            setStep(Math.min(saved.step ?? 0, 3))
          }
        }
      } catch {
        /* missing or foreign draft: start fresh */
      }
      loaded.current = true
      setReady(true)
    })()
  }, [params])

  useEffect(() => {
    if (!loaded.current) return
    try { localStorage.setItem(LS_KEY, JSON.stringify({ d, step, draftId })) } catch {}
  }, [d, step, draftId])

  // Keep the server draft in sync (debounced) once it exists.
  useEffect(() => {
    if (!draftId || !loaded.current || step >= 4) return
    const t = setTimeout(() => {
      if (d.recipientName && d.creatorName) api(`/api/surprises/${draftId}`, { method: 'PATCH', body: { input: clean(d) } }).catch(() => {})
    }, 800)
    return () => clearTimeout(t)
  }, [d, draftId, step])

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }))

  const validate = () => {
    const e: Record<string, string> = {}
    if (step === 1) {
      if (!d.recipientName.trim()) e.recipientName = 'Who is this surprise for?'
      if (!d.creatorName.trim()) e.creatorName = 'Add your name so they know it’s from you.'
    }
    if (step === 0 && d.occasion === 'custom' && !d.customOccasion.trim()) e.customOccasion = 'Name the occasion.'
    if (step === 3 && !d.experienceType) e.experienceType = 'Pick one experience.'
    setErrors(e)
    return !Object.keys(e).length
  }

  const ensureDraft = async () => {
    if (draftId) {
      await api(`/api/surprises/${draftId}`, { method: 'PATCH', body: { input: clean(d) } })
      return draftId
    }
    const { id } = await api<{ id: string }>('/api/surprises', { body: clean(d) })
    setDraftId(id)
    router.replace(`/create?d=${id}`, { scroll: false })
    return id
  }

  const next = async () => {
    if (!validate()) return
    try {
      if (step >= 1) {
        setBusy(true)
        await ensureDraft()
      }
      if (step === 3) return generate()
      setStep(step + 1)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err) {
      toast((err as Error).message, 'bad')
    } finally {
      setBusy(false)
    }
  }

  // On the first step, Back leaves the studio (the draft is kept) instead of doing nothing.
  const back = () => {
    if (step > 0) return setStep(step - 1)
    if (window.history.length > 1) router.back()
    else router.push('/')
  }

  const generate = async () => {
    setStep(4)
    setGenError(null)
    try {
      const id = await ensureDraft()
      await api(`/api/surprises/${id}/generate`, { body: {} })
      try { localStorage.removeItem(LS_KEY) } catch {}
      router.push(`/studio/${id}?fresh=1`)
    } catch (err) {
      setGenError((err as Error).message)
    }
  }

  if (!ready) return <div className="py-32 grid place-items-center text-ink-soft" aria-busy><Spinner className="size-8" /></div>

  return (
    <div className="mx-auto max-w-3xl px-5 pb-28">
      {/* Stepper */}
      <ol className="flex items-center gap-2 mb-10" aria-label="Steps">
        {STEPS.map((s, i) => (
          <li key={s} className="flex-1">
            <div className={cx('h-1.5 rounded-full transition-colors duration-500', i <= step ? 'bg-rose' : 'bg-line')} />
            <p className={cx('mt-2 text-xs font-semibold hidden sm:block', i === step ? 'text-ink' : 'text-ink-soft')} aria-current={i === step ? 'step' : undefined}>{s}</p>
          </li>
        ))}
      </ol>

      <AnimatePresence mode="wait">
        <motion.div key={step} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.3 }}>
          {step === 0 && (
            <section>
              <h1 className="font-display text-4xl sm:text-5xl">What are we celebrating?</h1>
              <p className="text-ink-soft mt-3 text-lg">Pick the moment — everything else follows from it.</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-8" role="radiogroup" aria-label="Occasion">
                {OCCASIONS.map((o: Occasion, i) => (
                  <motion.button
                    key={o}
                    role="radio"
                    aria-checked={d.occasion === o}
                    onClick={() => set('occasion', o)}
                    whileHover={{ y: -4, rotate: i % 2 ? 1 : -1 }}
                    whileTap={{ scale: 0.96 }}
                    className={cx('relative rounded-[var(--radius-card)] p-5 text-left bg-gradient-to-br shadow-[var(--shadow-soft)] ring-2 transition', OCCASION_INFO[o].tint, d.occasion === o ? 'ring-ink' : 'ring-transparent')}
                  >
                    <span className="text-4xl block" aria-hidden>{OCCASION_INFO[o].emoji}</span>
                    <span className="font-display text-xl block mt-6">{OCCASION_INFO[o].label}</span>
                    <span className="text-sm text-ink/70">{OCCASION_INFO[o].blurb}</span>
                    {d.occasion === o && <span className="absolute top-4 right-4 size-6 rounded-full bg-ink text-white grid place-items-center text-xs" aria-hidden>✓</span>}
                  </motion.button>
                ))}
              </div>
              {d.occasion === 'custom' && (
                <div className="mt-6 max-w-md">
                  <Field label="Name the occasion" error={errors.customOccasion}>
                    {(id) => <Input id={id} value={d.customOccasion} onChange={(e) => set('customOccasion', e.target.value)} placeholder="e.g. Graduation, new job, first apartment" maxLength={80} />}
                  </Field>
                </div>
              )}
            </section>
          )}

          {step === 1 && (
            <section>
              <h1 className="font-display text-4xl sm:text-5xl">Tell us about them</h1>
              <p className="text-ink-soft mt-3 text-lg">Only the names are required. The more you share, the more it sounds like you.</p>
              <Card className="mt-8 p-6 sm:p-8 grid sm:grid-cols-2 gap-5">
                <Field label="Their name" error={errors.recipientName}>
                  {(id) => <Input id={id} value={d.recipientName} onChange={(e) => set('recipientName', e.target.value)} placeholder="Maya" maxLength={60} autoFocus />}
                </Field>
                <Field label="Your name" error={errors.creatorName}>
                  {(id) => <Input id={id} value={d.creatorName} onChange={(e) => set('creatorName', e.target.value)} placeholder="Rohan" maxLength={60} />}
                </Field>
                <Field label="Who are they to you?" optional>
                  {(id) => <Input id={id} value={d.relationship} onChange={(e) => set('relationship', e.target.value)} placeholder="Best friend since college" maxLength={80} />}
                </Field>
                <Field label="Language" optional>
                  {(id) => <Input id={id} value={d.language} onChange={(e) => set('language', e.target.value)} placeholder="English, Hinglish, Spanish…" maxLength={40} />}
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Their personality" optional hint="Three words their friends would use.">
                    {(id) => <Input id={id} value={d.personality} onChange={(e) => set('personality', e.target.value)} placeholder="Chaotic, kind, always 10 minutes late" maxLength={400} />}
                  </Field>
                </div>
                <Field label="Interests & hobbies" optional>
                  {(id) => <Input id={id} value={d.interests} onChange={(e) => set('interests', e.target.value)} placeholder="Bouldering, sci-fi, ramen" maxLength={400} />}
                </Field>
                <Field label="Things they love" optional>
                  {(id) => <Input id={id} value={d.loves} onChange={(e) => set('loves', e.target.value)} placeholder="Rainy days, her cat Mochi" maxLength={400} />}
                </Field>
              </Card>
              <h2 className="font-semibold mt-8 mb-3">What should it feel like?</h2>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Tone">
                {TONES.map((t) => (
                  <button key={t} role="radio" aria-checked={d.tone === t} onClick={() => set('tone', t)} className={cx('h-10 px-4 rounded-full text-sm font-semibold ring-1 transition', d.tone === t ? 'bg-ink text-white ring-ink' : 'bg-white ring-line hover:ring-ink/30')}>
                    {TONE_LABELS[t]}
                  </button>
                ))}
              </div>
            </section>
          )}

          {step === 2 && (
            <section>
              <h1 className="font-display text-4xl sm:text-5xl">The good stuff</h1>
              <p className="text-ink-soft mt-3 text-lg">Memories and jokes are what make it theirs. Everything here is optional — and we only use what you write, never invent.</p>
              <div className="mt-8 space-y-6">
                <Card className="p-6 sm:p-8 space-y-6">
                  <Field label="Shared memories" optional hint="One per box. Specific beats general: where, when, what went wrong.">
                    {() => <ListInput values={d.memories} onChange={(v) => set('memories', v)} placeholder="We got lost in Goa looking for a beach shack that didn’t exist" max={10} multiline />}
                  </Field>
                  <Field label="Inside jokes" optional>
                    {() => <ListInput values={d.insideJokes} onChange={(v) => set('insideJokes', v)} placeholder="“One more episode”" max={8} />}
                  </Field>
                </Card>
                <Card className="p-6 sm:p-8 grid sm:grid-cols-2 gap-6">
                  <Field label="Important dates" optional>
                    {() => <ListInput values={d.importantDates} onChange={(v) => set('importantDates', v)} placeholder="Met on 12 Aug 2017" max={6} />}
                  </Field>
                  <Field label="Special phrases" optional>
                    {() => <ListInput values={d.specialPhrases} onChange={(v) => set('specialPhrases', v)} placeholder="“You absolute legend”" max={6} />}
                  </Field>
                </Card>
                <Card className="p-6 sm:p-8 space-y-6">
                  <Field label="What you appreciate about them" optional>
                    {(id) => <Textarea id={id} value={d.appreciation} onChange={(e) => set('appreciation', e.target.value)} placeholder="How she shows up for everyone, even when she’s tired" maxLength={800} />}
                  </Field>
                  <Field label="A personal message, in your own words" optional hint="We’ll keep its meaning and feeling; it often becomes the final reveal.">
                    {(id) => <Textarea id={id} value={d.personalMessage} onChange={(e) => set('personalMessage', e.target.value)} rows={4} maxLength={1200} />}
                  </Field>
                </Card>
              </div>
            </section>
          )}

          {step === 3 && (
            <section>
              <h1 className="font-display text-4xl sm:text-5xl">Choose the experience</h1>
              <p className="text-ink-soft mt-3 text-lg">How should {d.recipientName || 'they'} unwrap it?</p>
              {errors.experienceType && <p className="text-rose-deep mt-3 text-sm font-semibold" role="alert">{errors.experienceType}</p>}
              <div className="grid sm:grid-cols-2 gap-4 mt-8" role="radiogroup" aria-label="Experience">
                {EXPERIENCES.map((e) => (
                  <button key={e} role="radio" aria-checked={d.experienceType === e} onClick={() => set('experienceType', e)} className={cx('text-left rounded-[var(--radius-card)] bg-white p-6 ring-2 shadow-[var(--shadow-soft)] transition hover:-translate-y-0.5', d.experienceType === e ? 'ring-rose' : 'ring-transparent')}>
                    <span className="text-3xl" aria-hidden>{EXPERIENCE_INFO[e].emoji}</span>
                    <span className="block font-display text-xl mt-3">{EXPERIENCE_INFO[e].label}</span>
                    <span className="block text-sm text-ink-soft mt-1">{EXPERIENCE_INFO[e].blurb}</span>
                  </button>
                ))}
              </div>
              {d.experienceType === 'treasure_hunt' && (
                <div className="mt-6 max-w-xs">
                  <Field label="Riddle difficulty">
                    {(id) => (
                      <Select id={id} value={d.difficulty} onChange={(e) => set('difficulty', e.target.value as Draft['difficulty'])}>
                        <option value="easy">Easy — a gentle stroll</option>
                        <option value="medium">Medium — a little head-scratch</option>
                        <option value="hard">Hard — make them work for it</option>
                      </Select>
                    )}
                  </Field>
                </div>
              )}
            </section>
          )}

          {step === 4 && (
            <section className="text-center py-16" aria-live="polite">
              {genError ? (
                <div className="max-w-md mx-auto text-left">
                  <ErrorState message={genError} onRetry={generate} />
                  <Button variant="ghost" className="mt-4" onClick={() => setStep(3)}>← Back to experiences</Button>
                </div>
              ) : (
                <GeneratingScreen name={d.recipientName} />
              )}
            </section>
          )}
        </motion.div>
      </AnimatePresence>

      {step < 4 && (
        <div className="fixed bottom-0 inset-x-0 z-30 bg-paper/90 backdrop-blur border-t border-line">
          <div className="mx-auto max-w-3xl px-5 py-4 flex items-center justify-between">
            <Button variant="ghost" onClick={back}>← Back</Button>
            <Button onClick={next} loading={busy} size="lg">{step === 3 ? 'Create my surprise ✨' : 'Continue →'}</Button>
          </div>
        </div>
      )}
    </div>
  )
}

function GeneratingScreen({ name }: { name: string }) {
  const [i, setI] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setI((x) => (x + 1) % LOADING_LINES.length), 2600)
    return () => clearInterval(t)
  }, [])
  return (
    <div>
      <motion.div animate={{ rotate: [0, -8, 8, -4, 0], y: [0, -8, 0] }} transition={{ repeat: Infinity, duration: 1.8 }} className="text-8xl inline-block" aria-hidden>🎁</motion.div>
      <h1 className="font-display text-4xl mt-8">Making something for {name}…</h1>
      <AnimatePresence mode="wait">
        <motion.p key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="font-hand text-2xl text-ink-soft mt-4">
          {LOADING_LINES[i]}
        </motion.p>
      </AnimatePresence>
      <p className="text-sm text-ink-soft mt-10">Usually 15–40 seconds. You can edit every word afterwards.</p>
    </div>
  )
}
