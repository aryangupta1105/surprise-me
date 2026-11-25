import type { Metadata } from 'next'
import { openByToken } from '@/server/surprises'
import { linkState } from '@/server/sharing'
import { RecipientView } from './RecipientView'
import { UnlockForm } from './UnlockForm'

export const metadata: Metadata = { title: 'A surprise for you', robots: { index: false, follow: false } }

export default async function RecipientPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const s = await openByToken(token)
  if (!s) {
    const locked = (await linkState(token)) === 'locked'
    return (
      <main className="grain min-h-dvh grid place-items-center p-6 text-center">
        <div className="w-full max-w-sm">
          <div className="text-6xl" aria-hidden>{locked ? '🎁' : '🔐'}</div>
          <h1 className="font-display text-3xl mt-4">{locked ? 'A surprise is waiting' : 'This surprise isn’t available'}</h1>
          <p className="text-ink-soft mt-2">{locked ? 'It’s protected with a password — the person who sent it will have told you.' : 'The link may have expired or been turned off by the person who made it.'}</p>
          {locked && <UnlockForm token={token} />}
        </div>
      </main>
    )
  }
  // Only recipient-safe fields cross to the client: no ids, owner data or creator inputs.
  return <RecipientView token={token} doc={s.doc} creatorName={s.creatorName} />
}
