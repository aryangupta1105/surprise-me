import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Nav } from '@/components/site/Nav'
import { db } from '@/lib/db'
import { currentUser } from '@/lib/session'
import { shareUrl } from '@/server/surprises'
import { StudioEditor, type EditorSurprise } from './StudioEditor'

export const metadata: Metadata = { title: 'Your surprise', robots: { index: false } }

export default async function StudioPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser()
  const { id } = await params
  const s = user && (await db.surprise.findFirst({ where: { id, ownerId: user.id } }))
  if (!s) notFound() // creator pages are authorised by session ownership, never by knowing the id
  const surprise: EditorSurprise = {
    id: s.id,
    status: s.status,
    title: s.title,
    recipientName: s.recipientName,
    creatorName: s.creatorName,
    occasion: s.occasion,
    content: s.content as EditorSurprise['content'],
    theme: s.theme as EditorSurprise['theme'],
    generationStatus: s.generationStatus,
    generationError: s.generationError,
    url: shareUrl(s),
    linkRevokedAt: s.linkRevokedAt?.toISOString() ?? null,
    linkExpiresAt: s.linkExpiresAt?.toISOString() ?? null,
    openCount: s.openCount,
    progress: s.progress,
    lastOpenedAt: s.lastOpenedAt?.toISOString() ?? null,
    completedAt: s.completedAt?.toISOString() ?? null,
  }
  return (
    <div className="grain relative min-h-dvh">
      <Nav />
      <main className="relative z-10">
        <StudioEditor initial={surprise} isGuest={user.isGuest} />
      </main>
    </div>
  )
}
