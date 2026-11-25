import type { Metadata, Viewport } from 'next'
import { Caveat, Fraunces, Manrope } from 'next/font/google'
import { Toaster } from '@/components/ui'
import './globals.css'

const fraunces = Fraunces({ variable: '--font-fraunces', subsets: ['latin'], axes: ['SOFT', 'opsz'] })
const manrope = Manrope({ variable: '--font-manrope', subsets: ['latin'] })
const caveat = Caveat({ variable: '--font-caveat', subsets: ['latin'] })

export const metadata: Metadata = {
  title: { default: 'SurpriseMe — Make someone’s day unforgettable', template: '%s · SurpriseMe' },
  description: 'Create a personal, interactive digital surprise — a treasure hunt, a memory journey, letters to open later — in minutes.',
}
export const viewport: Viewport = { themeColor: '#fff8f1' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${manrope.variable} ${caveat.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <Toaster>{children}</Toaster>
      </body>
    </html>
  )
}
