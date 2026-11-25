'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { Button, Card, Chip, EmptyState, ErrorState, Spinner, api, cx, useToast } from '@/components/ui'
import { EXPERIENCE_INFO, OCCASION_INFO } from '@/lib/catalog'
import { EXPERIENCES, type ExperienceType, type Occasion } from '@/lib/schemas'

type Row = {
  id: string; title: string | null; recipientName: string; occasion: Occasion; experienceType: ExperienceType | null
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'; createdAt: string; updatedAt: string; url: string | null; linkRevokedAt: string | null
  openCount: number; lastOpenedAt: string | null; progress: number; completedAt: string | null; nextDelivery: string | null; generationStatus: string
}
const FILTERS = ['All', 'Drafts', 'Published', 'Scheduled', 'Archived'] as const
const match: Record<(typeof FILTERS)[number], (r: Row) => boolean> = {
  All: (r) => r.status !== 'ARCHIVED',
  Drafts: (r) => r.status === 'DRAFT',
  Published: (r) => r.status === 'PUBLISHED',
  Scheduled: (r) => Boolean(r.nextDelivery),
  Archived: (r) => r.status === 'ARCHIVED',
}
const date = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })

export function Dashboard() {
  const toast = useToast()
  const [rows, setRows] = useState<Row[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('All')

  const load = useCallback(async () => {
    try {
      setRows((await api<{ surprises: Row[] }>('/api/surprises')).surprises)
      setError(null)
    } catch (e) {
      setError((e as Error).message)
    }
  }, [])
  useEffect(() => {
    api<{ surprises: Row[] }>('/api/surprises').then((r) => setRows(r.surprises), (e) => setError((e as Error).message))
  }, [])

  const act = async (fn: () => Promise<unknown>, done: string) => {
    try {
      await fn()
      toast(done, 'good')
      await load()
    } catch (e) {
      toast((e as Error).message, 'bad')
    }
  }

  const shown = rows?.filter(match[filter]) ?? []
  const welcome = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('welcome')

  return (
    <div className="mx-auto max-w-6xl px-5 pb-24">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl sm:text-5xl">My surprises</h1>
          {welcome && <p className="text-ink-soft mt-2">You’re signed in — everything you made as a guest is here.</p>}
        </div>
        <Button href="/create" size="lg">+ New surprise</Button>
      </div>

      <div className="flex gap-2 mt-7 overflow-x-auto p-1 -mx-1" role="tablist">
        {FILTERS.map((f) => (
          <button key={f} role="tab" aria-selected={filter === f} onClick={() => setFilter(f)} className={cx('h-10 px-4 rounded-full text-sm font-semibold ring-1 whitespace-nowrap', filter === f ? 'bg-ink text-white ring-ink' : 'bg-white ring-line')}>
            {f} {rows && <span className="opacity-60 ml-1">{rows.filter(match[f]).length}</span>}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {error ? (
          <ErrorState message={error} onRetry={load} />
        ) : !rows ? (
          <div className="py-20 grid place-items-center text-ink-soft"><Spinner className="size-8" /></div>
        ) : shown.length === 0 ? (
          <EmptyState
            emoji={filter === 'Archived' ? '🗃️' : '🎈'}
            title={rows.length ? `Nothing in ${filter.toLowerCase()}` : 'No surprises yet'}
            body={rows.length ? 'Try another tab.' : 'Your first one takes about four minutes. Someone’s day is about to get better.'}
            action={!rows.length && <Button href="/create">Create a surprise</Button>}
          />
        ) : (
          <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {shown.map((r) => {
              const exp = r.experienceType ? EXPERIENCE_INFO[r.experienceType] : null
              const live = r.url && !r.linkRevokedAt && r.status === 'PUBLISHED'
              return (
                <li key={r.id}>
                  <Card className="p-6 h-full flex flex-col">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-3xl" aria-hidden>{exp?.emoji ?? OCCASION_INFO[r.occasion]?.emoji}</span>
                      <div className="flex gap-1 flex-wrap justify-end">
                        <Chip tone={r.status === 'PUBLISHED' ? 'good' : r.status === 'DRAFT' ? 'info' : 'neutral'}>{r.status.toLowerCase()}</Chip>
                        {r.linkRevokedAt && <Chip tone="bad">link off</Chip>}
                        {r.nextDelivery && <Chip tone="warn">⏰ {date(r.nextDelivery)}</Chip>}
                      </div>
                    </div>
                    <Link href={r.generationStatus === 'SUCCEEDED' ? `/studio/${r.id}` : `/create/guided?d=${r.id}`} className="font-display text-xl mt-4 hover:text-rose">{r.title ?? `A surprise for ${r.recipientName}`}</Link>
                    <p className="text-sm text-ink-soft mt-1">For {r.recipientName} · {OCCASION_INFO[r.occasion]?.label}{exp ? ` · ${exp.label}` : ''}</p>
                    <p className="text-xs text-ink-soft mt-1">Created {date(r.createdAt)}</p>
                    {r.status === 'PUBLISHED' && (
                      <div className="mt-4 rounded-2xl bg-cream px-4 py-3 text-sm flex justify-between">
                        <span>👀 {r.openCount} open{r.openCount === 1 ? '' : 's'}</span>
                        <span>{r.completedAt ? '✅ finished' : `${r.progress}% through`}</span>
                      </div>
                    )}
                    <div className="mt-auto pt-5 flex flex-wrap gap-1.5">
                      <Button size="sm" variant="secondary" href={r.generationStatus === 'SUCCEEDED' ? `/studio/${r.id}` : `/create/guided?d=${r.id}`}>Edit</Button>
                      {live && <Button size="sm" variant="ghost" onClick={() => navigator.clipboard.writeText(r.url!).then(() => toast('Link copied', 'good'))}>Copy link</Button>}
                      {live && <Button size="sm" variant="ghost" onClick={() => confirm('Turn off this link?') && act(() => api(`/api/surprises/${r.id}/revoke`, { body: {} }), 'Link turned off')}>Revoke</Button>}
                      {r.nextDelivery && <Button size="sm" variant="ghost" href={`/studio/${r.id}?tab=share`}>Reschedule</Button>}
                      <Button size="sm" variant="ghost" onClick={() => act(() => api(`/api/surprises/${r.id}/duplicate`, { body: {} }), 'Duplicated')}>Duplicate</Button>
                      <Button size="sm" variant="ghost" onClick={() => act(() => api(`/api/surprises/${r.id}/archive`, { body: { archived: r.status !== 'ARCHIVED' } }), r.status === 'ARCHIVED' ? 'Restored' : 'Archived')}>{r.status === 'ARCHIVED' ? 'Restore' : 'Archive'}</Button>
                      <Button size="sm" variant="ghost" className="text-rose-deep" onClick={() => confirm('Delete this surprise for good? Its link, photos and scheduled emails are removed too. This cannot be undone.') && act(() => api(`/api/surprises/${r.id}`, { method: 'DELETE' }), 'Deleted')}>Delete</Button>
                    </div>
                  </Card>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <section className="mt-20">
        <h2 className="font-display text-3xl">Start from a template</h2>
        <div className="mt-6 grid grid-cols-2 lg:grid-cols-3 gap-4">
          {EXPERIENCES.map((e) => (
            <Link key={e} href={`/create/guided?exp=${e}`} className="rounded-[var(--radius-card)] bg-white ring-1 ring-line p-5 hover:-translate-y-0.5 hover:shadow-[var(--shadow-soft)] transition">
              <span className="text-2xl" aria-hidden>{EXPERIENCE_INFO[e].emoji}</span>
              <p className="font-semibold mt-2">{EXPERIENCE_INFO[e].label}</p>
              <p className="text-sm text-ink-soft">{EXPERIENCE_INFO[e].best}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
