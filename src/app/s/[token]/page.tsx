import type { Metadata } from 'next'
import { openByToken } from '@/server/surprises'
import { RecipientView } from './RecipientView'

export const metadata: Metadata = { title: 'A surprise for you', robots: { index: false, follow: false } }

export default async function RecipientPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const s = await openByToken(token)
  if (!s)
    return (
      <main className="grain min-h-dvh grid place-items-center p-6 text-center">
        <div>
          <div className="text-6xl" aria-hidden>🔐</div>
          <h1 className="font-display text-3xl mt-4">This surprise isn’t available</h1>
          <p className="text-ink-soft mt-2 max-w-sm">The link may have expired or been turned off by the person who made it.</p>
        </div>
      </main>
    )
  // Only recipient-safe fields cross to the client: no ids, owner data or creator inputs.
  return <RecipientView token={token} doc={s.doc} />
}
