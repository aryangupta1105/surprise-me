import type { Metadata } from 'next'
import { inviteTarget } from '@/server/sharing'
import { ContributeForm } from './ContributeForm'

export const metadata: Metadata = { title: 'Add your message', robots: { index: false, follow: false } }

/** A friend's view of the invite link: who it's for, who's making it, and one box for their note. */
export default async function ContributePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const s = await inviteTarget(token)
  return (
    <main className="grain min-h-dvh grid place-items-center p-6">
      <div className="w-full max-w-md text-center">
        <div className="text-6xl" aria-hidden>💌</div>
        {s ? (
          <>
            <h1 className="font-display text-3xl mt-4">Add a message for {s.recipientName}</h1>
            <p className="text-ink-soft mt-2">{s.creatorName} is making {s.recipientName} a surprise and would love a few words from you. Keep it a secret!</p>
            <ContributeForm token={token} />
          </>
        ) : (
          <>
            <h1 className="font-display text-3xl mt-4">This invitation has ended</h1>
            <p className="text-ink-soft mt-2">The surprise may already be finished. Thanks for thinking of them!</p>
          </>
        )}
      </div>
    </main>
  )
}
