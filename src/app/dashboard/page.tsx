import type { Metadata } from 'next'
import { Nav } from '@/components/site/Nav'
import { Dashboard } from './Dashboard'

export const metadata: Metadata = { title: 'My surprises', robots: { index: false } }

export default function DashboardPage() {
  return (
    <div className="grain relative min-h-dvh">
      <Nav />
      <main className="relative z-10">
        <Dashboard />
      </main>
    </div>
  )
}
