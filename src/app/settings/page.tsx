import type { Metadata } from 'next'
import { Nav } from '@/components/site/Nav'
import { currentUser } from '@/lib/session'
import { Settings } from './Settings'

export const metadata: Metadata = { title: 'Settings', robots: { index: false } }

export default async function SettingsPage() {
  const user = await currentUser()
  return (
    <div className="grain relative min-h-dvh">
      <Nav />
      <main className="relative z-10">
        <Settings
          user={user && { isGuest: user.isGuest, email: user.email, name: user.name }}
          blocksReferenceId={process.env.NEXT_PUBLIC_BLOCKS_REFERENCE_ID ?? null}
        />
      </main>
    </div>
  )
}
