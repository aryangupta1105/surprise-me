import type { Metadata } from 'next'
import { Nav } from '@/components/site/Nav'
import { TemplateGallery } from './TemplateGallery'

export const metadata: Metadata = { title: 'Templates' }

export default function TemplatesPage() {
  return (
    <div className="grain relative min-h-dvh">
      <Nav />
      <main className="relative z-10 pt-6">
        <TemplateGallery />
      </main>
    </div>
  )
}
