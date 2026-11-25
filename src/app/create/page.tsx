import type { Metadata } from 'next'
import { Suspense } from 'react'
import { Nav } from '@/components/site/Nav'
import { Studio } from './Studio'

export const metadata: Metadata = { title: 'Create a surprise' }

export default function CreatePage() {
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
