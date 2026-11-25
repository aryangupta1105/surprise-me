import type { Metadata } from 'next'
import { Nav } from '@/components/site/Nav'
import { currentUser } from '@/lib/session'
import { Dashboard } from './Dashboard'

export const metadata: Metadata = { title: 'My surprises', robots: { index: false } }

export default async function DashboardPage() {
  const user = await currentUser()
  return (
    <div className="grain relative min-h-dvh">
      <Nav />
      <main className="relative z-10">
        <Dashboard isGuest={!user || user.isGuest} />
      </main>
    </div>
  )
}
