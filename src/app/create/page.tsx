import type { Metadata } from 'next'
import { Nav } from '@/components/site/Nav'
import { QuickCreate } from './QuickCreate'

export const metadata: Metadata = { title: 'Create a surprise' }

export default function CreatePage() {
  return (
    <div className="grain relative min-h-dvh">
      <Nav />
      <main className="relative z-10 pt-6">
        <QuickCreate />
      </main>
    </div>
  )
}
