import type { Metadata } from 'next'
import { Suspense } from 'react'
import { Nav } from '@/components/site/Nav'
import { Studio } from './Studio'

export const metadata: Metadata = { title: 'Guided create' }

export default function GuidedPage() {
  return (
    <div className="grain relative min-h-dvh">
      <Nav />
      <main className="relative z-10 pt-4">
        <Suspense>
          <Studio />
        </Suspense>
      </main>
    </div>
  )
}
