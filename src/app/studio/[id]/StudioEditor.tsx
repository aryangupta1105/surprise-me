'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { legacyToDoc } from '@/engine/convert'
import { Player } from '@/engine/player/Player'
import { Button, Card, Chip, ErrorState, api, cx, useToast } from '@/components/ui'
import { EXPERIENCE_INFO, PALETTE_INFO } from '@/lib/catalog'
import { MOTION, PALETTES, StoredContent, type Theme } from '@/lib/schemas'
import { ContentEditor } from './ContentEditor'
import { SharePanel } from './SharePanel'

export type EditorSurprise = {
  id: string
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
  title: string | null
  recipientName: string
  creatorName: string
  occasion: string
  content: StoredContent | null
  theme: Theme | null
  generationStatus: 'IDLE' | 'PENDING' | 'SUCCEEDED' | 'FAILED'
  generationError: string | null
  url: string | null
  linkRevokedAt: string | null
  linkExpiresAt: string | null
  openCount: number
  progress: number
  lastOpenedAt: string | null
  completedAt: string | null
}

const TABS = ['Edit', 'Preview', 'Share'] as const

export function StudioEditor({ initial, isGuest }: { initial: EditorSurprise; isGuest: boolean }) {
  const router = useRouter()
  const params = useSearchParams()
  const toast = useToast()
  const [s, setS] = useState(initial)
  const [content, setContent] = useState<StoredContent | null>(initial.content)
  const [theme, setTheme] = useState<Theme>(initial.theme ?? { palette: initial.content?.palette ?? 'sunrise', motion: 'full' })
  const [tab, setTab] = useState<(typeof TABS)[number]>(params.get('tab') === 'share' ? 'Share' : 'Edit')
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [converting, setConverting] = useState(false)
  const convert = async () => {
    if (dirty && !confirm('You have unsaved changes. Switch anyway? (Unsaved edits will be lost.)')) return
    setConverting(true)
    try {
      await api(`/api/surprises/${s.id}/convert`, { body: {} })
      window.location.reload()
    } catch (e) {
      toast((e as Error).message, 'bad')
      setConverting(false)
    }
  }
  const [generating, setGenerating] = useState(false)
  const [previewKey, setPreviewKey] = useState(0)

  useEffect(() => {
    if (params.get('fresh')) toast('Your surprise is ready — have a look and make it yours ✨', 'good')
  }, [params, toast])

  // Warn before leaving with unsaved edits.
  useEffect(() => {
    if (!dirty) return
    const h = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [dirty])

  const validation = useMemo(() => (content ? StoredContent.safeParse(content) : null), [content])

  const update = (c: StoredContent) => {
    setContent(c)
    setDirty(true)
  }
  const updateTheme = (t: Theme) => {
    setTheme(t)
    setDirty(true)
  }

  const save = async () => {
    if (!content || !validation?.success) return toast('Some fields need attention before saving.', 'bad')
    setSaving(true)
    try {
      await api(`/api/surprises/${s.id}`, { method: 'PATCH', body: { content: validation.data, theme } })
      setDirty(false)
      toast('Saved', 'good')
      return true
    } catch (e) {
      toast((e as Error).message, 'bad')
    } finally {
      setSaving(false)
    }
  }

  const regenerateAll = async () => {
    if (dirty && !confirm('Regenerating replaces your edits. Continue?')) return
    setGenerating(true)
    try {
      const { content: c } = await api<{ content: StoredContent }>(`/api/surprises/${s.id}/generate`, { body: {} })
      setContent(c)
      setTheme((t) => ({ ...t, palette: c.palette }))
      setDirty(false)
      setPreviewKey((k) => k + 1)
      setS((x) => ({ ...x, generationStatus: 'SUCCEEDED', generationError: null }))
      toast('Freshly rewritten ✨', 'good')
    } catch (e) {
      setS((x) => ({ ...x, generationStatus: 'FAILED', generationError: (e as Error).message }))
    } finally {
      setGenerating(false)
    }
  }

  if (!content)
    return (
      <div className="mx-auto max-w-lg px-5 py-16">
        <h1 className="font-display text-3xl">Almost there</h1>
        <p className="text-ink-soft mt-2">This surprise hasn’t been written yet.</p>
        {s.generationError && <div className="mt-6"><ErrorState message={s.generationError} /></div>}
        <div className="mt-6 flex gap-3">
          <Button onClick={regenerateAll} loading={generating}>Write it now ✨</Button>
          <Button variant="secondary" href={`/create/guided?d=${s.id}`}>Edit details</Button>
        </div>
      </div>
    )

  const previewDoc = validation?.success ? legacyToDoc(validation.data, theme) : null
  const preview = previewDoc ? (
    <Player key={previewKey} doc={previewDoc} photo={(id) => (id ? `/api/uploads/${id}` : null)} preview />
  ) : (
    <div className="min-h-[640px] grid place-items-center p-8 text-center text-ink-soft bg-white">Fix the highlighted fields to see the preview.</div>
  )

  return (
    <div className="mx-auto max-w-7xl px-5 pb-24">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <p className="text-sm font-semibold text-ink-soft flex items-center gap-2">
            {EXPERIENCE_INFO[content.type].emoji} {EXPERIENCE_INFO[content.type].label} · for {s.recipientName}
            <Chip tone={s.status === 'PUBLISHED' ? 'good' : s.status === 'ARCHIVED' ? 'neutral' : 'info'}>{s.status.toLowerCase()}</Chip>
          </p>
          <h1 className="font-display text-3xl sm:text-4xl mt-1">{content.title}</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={regenerateAll} loading={generating}>↻ Rewrite all</Button>
          <Button onClick={save} loading={saving} disabled={!dirty}>{dirty ? 'Save changes' : 'Saved'}</Button>
        </div>
      </div>
      {s.generationError && s.generationStatus === 'FAILED' && <div className="mb-6"><ErrorState message={s.generationError} onRetry={regenerateAll} /></div>}
      <div className="mb-6 rounded-2xl bg-white ring-1 ring-line p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <p className="text-sm"><span className="font-semibold">Want more?</span> <span className="text-ink-soft">Switch to the scene editor to add scenes, photos, music, video and templates. Your published link keeps showing what it shows now until you publish again.</span></p>
        <Button size="sm" variant="secondary" loading={converting} onClick={convert}>Switch to scene editor</Button>
      </div>

      <div role="tablist" className="inline-flex rounded-full bg-white ring-1 ring-line p-1 mb-6 lg:hidden">
        {TABS.map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={cx('h-9 px-5 rounded-full text-sm font-semibold', tab === t ? 'bg-ink text-white' : 'text-ink-soft')}>{t}</button>
        ))}
      </div>
      <div className="hidden lg:inline-flex rounded-full bg-white ring-1 ring-line p-1 mb-6" role="tablist">
        {(['Edit', 'Share'] as const).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t || (t === 'Edit' && tab === 'Preview')} onClick={() => setTab(t)} className={cx('h-9 px-5 rounded-full text-sm font-semibold', (tab === t || (t === 'Edit' && tab === 'Preview')) ? 'bg-ink text-white' : 'text-ink-soft')}>{t === 'Edit' ? 'Edit & preview' : 'Publish & share'}</button>
        ))}
      </div>

      {tab === 'Share' ? (
        <SharePanel s={s} setS={setS} dirty={dirty} save={save} isGuest={isGuest} />
      ) : (
        <div className="grid lg:grid-cols-[minmax(0,1fr)_420px] gap-8 items-start">
          <div className={cx('space-y-6', tab === 'Preview' && 'hidden lg:block')}>
            <Card className="p-6">
              <h2 className="font-semibold mb-4">Look & feel</h2>
              <div className="flex flex-wrap gap-3" role="radiogroup" aria-label="Colour palette">
                {PALETTES.map((p) => (
                  <button key={p} role="radio" aria-checked={theme.palette === p} onClick={() => updateTheme({ ...theme, palette: p })} className="flex flex-col items-center gap-1.5">
                    <span className={cx('size-12 rounded-2xl ring-2 ring-offset-2 transition', theme.palette === p ? 'ring-ink' : 'ring-transparent')} style={{ background: PALETTE_INFO[p].swatch }} />
                    <span className="text-xs font-semibold">{PALETTE_INFO[p].label}</span>
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-3 mt-5 text-sm">
                <span className="font-semibold">Animation</span>
                {MOTION.map((m) => (
                  <button key={m} onClick={() => updateTheme({ ...theme, motion: m })} className={cx('h-8 px-3 rounded-full ring-1 font-semibold capitalize', theme.motion === m ? 'bg-ink text-white ring-ink' : 'ring-line')}>{m}</button>
                ))}
              </div>
            </Card>
            <ContentEditor surpriseId={s.id} content={content} onChange={update} issues={validation && !validation.success ? validation.error.issues : []} />
          </div>
          <div className={cx('lg:sticky lg:top-6', tab === 'Edit' && 'hidden lg:block')}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-ink-soft">Live preview — exactly what {s.recipientName} sees</p>
              <button onClick={() => setPreviewKey((k) => k + 1)} className="text-sm font-semibold text-rose">Restart</button>
            </div>
            <div className="rounded-[2rem] ring-8 ring-ink shadow-[var(--shadow-lift)] overflow-hidden max-h-[80dvh] overflow-y-auto">{preview}</div>
          </div>
        </div>
      )}
      {dirty && tab !== 'Share' && (
        <div className="fixed bottom-4 inset-x-0 flex justify-center z-30 pointer-events-none">
          <div className="pointer-events-auto rounded-full bg-ink text-white pl-5 pr-2 py-2 flex items-center gap-3 shadow-[var(--shadow-lift)]">
            <span className="text-sm">Unsaved changes</span>
            <Button size="sm" onClick={save} loading={saving}>Save</Button>
          </div>
        </div>
      )}
      <div className="mt-10">
        <Button variant="ghost" onClick={() => router.push('/dashboard')}>← All surprises</Button>
      </div>
    </div>
  )
}
