'use client'

import confetti from 'canvas-confetti'
import { AnimatePresence, MotionConfig, motion } from 'framer-motion'
import { useCallback, useRef, useState } from 'react'
import type { StoredContent, Theme } from '@/lib/schemas'
import { Cards } from './Cards'
import { GiftReveal } from './GiftReveal'
import { MemoryJourney } from './MemoryJourney'
import { OpenWhen } from './OpenWhen'
import { Quiz } from './Quiz'
import { TreasureHunt } from './TreasureHunt'

export type ExpProps<T> = {
  content: T
  photo: (id?: string) => string | null
  onProgress: (fraction: number) => void
  onDone: () => void
  celebrate: () => void
}

type Props = {
  content: StoredContent
  theme: Theme
  photo: (id?: string) => string | null
  onProgress?: (percent: number) => void
  /** Preview mode lives inside the editor: no full-screen height. */
  preview?: boolean
}

export function Experience({ content, theme, photo, onProgress, preview }: Props) {
  const [stage, setStage] = useState<'intro' | 'play' | 'closing'>('intro')
  const best = useRef(0)
  const motionOff = theme.motion === 'off'

  const report = useCallback(
    (fraction: number) => {
      const pct = Math.round(Math.max(0, Math.min(1, fraction)) * 100)
      if (pct > best.current) {
        best.current = pct
        onProgress?.(pct)
      }
    },
    [onProgress],
  )

  const celebrate = useCallback(() => {
    if (motionOff || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const n = theme.motion === 'gentle' ? 60 : 160
    confetti({ particleCount: n, spread: 90, origin: { y: 0.6 }, scalar: 1.1 })
    if (theme.motion === 'full') setTimeout(() => confetti({ particleCount: 80, angle: 60, spread: 70, origin: { x: 0 } }), 250)
    if (theme.motion === 'full') setTimeout(() => confetti({ particleCount: 80, angle: 120, spread: 70, origin: { x: 1 } }), 400)
  }, [motionOff, theme.motion])

  const done = useCallback(() => {
    report(1)
    setStage('closing')
    celebrate()
  }, [report, celebrate])

  const shared = { photo, onProgress: report, onDone: done, celebrate }
  const body = (() => {
    switch (content.type) {
      case 'treasure_hunt': return <TreasureHunt {...shared} content={content} />
      case 'memory_journey': return <MemoryJourney {...shared} content={content} />
      case 'quiz': return <Quiz {...shared} content={content} />
      case 'gift_reveal': return <GiftReveal {...shared} content={content} />
      case 'cards': return <Cards {...shared} content={content} />
      case 'open_when': return <OpenWhen {...shared} content={content} />
    }
  })()

  return (
    <MotionConfig reducedMotion={motionOff ? 'always' : 'user'} transition={theme.motion === 'gentle' ? { duration: 0.6, ease: 'easeOut' } : undefined}>
      <div data-palette={theme.palette} className={`relative overflow-hidden ${preview ? 'min-h-[640px] rounded-[1.75rem]' : 'min-h-dvh'}`}>
        <Sparkles off={motionOff} />
        <div className="relative z-10 mx-auto max-w-xl px-5 py-10 sm:py-16">
          <AnimatePresence mode="wait">
            {stage === 'intro' && (
              <motion.section key="intro" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -24 }} className="text-center pt-10">
                <p className="text-xs font-bold tracking-[0.3em] uppercase opacity-70">A surprise for you</p>
                <h1 className="font-display text-4xl sm:text-5xl leading-[1.05] mt-4 text-balance">{content.title}</h1>
                <p className="mt-3 text-lg opacity-80 text-balance">{content.subtitle}</p>
                <p className="mt-8 font-hand text-2xl leading-snug whitespace-pre-line">{content.intro}</p>
                <button onClick={() => setStage('play')} className="p-btn mt-10 h-14 px-10 rounded-full font-bold text-lg shadow-lg active:scale-95 transition">
                  Let’s begin ✨
                </button>
              </motion.section>
            )}
            {stage === 'play' && (
              <motion.section key="play" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                {body}
              </motion.section>
            )}
            {stage === 'closing' && (
              <motion.section key="closing" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="p-card rounded-[2rem] p-8 sm:p-10 shadow-xl text-center mt-6">
                <div className="text-5xl mb-4" aria-hidden>💝</div>
                <h2 className="font-display text-3xl sm:text-4xl text-balance">{content.closing.title}</h2>
                <p className="mt-5 text-lg leading-relaxed whitespace-pre-line">{content.closing.message}</p>
                <button onClick={() => setStage('intro')} className="mt-8 text-sm font-semibold underline underline-offset-4 opacity-70 hover:opacity-100">
                  Experience it again
                </button>
              </motion.section>
            )}
          </AnimatePresence>
        </div>
      </div>
    </MotionConfig>
  )
}

/** Soft floating dots in the palette accent. Purely decorative. */
function Sparkles({ off }: { off: boolean }) {
  if (off) return null
  const dots = [
    [8, 12, 10], [85, 8, 14], [70, 30, 8], [15, 55, 12], [92, 62, 10], [40, 85, 16], [60, 92, 8], [25, 30, 6],
  ]
  return (
    <div aria-hidden className="absolute inset-0 pointer-events-none">
      {dots.map(([x, y, s], i) => (
        <span
          key={i}
          className="float absolute rounded-full"
          style={{ left: `${x}%`, top: `${y}%`, width: s, height: s, background: 'var(--p-accent)', opacity: 0.18, animationDelay: `${i * 0.7}s` }}
        />
      ))}
    </div>
  )
}

export const Progress = ({ value, total }: { value: number; total: number }) => (
  <div className="flex gap-1.5 justify-center" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={value} aria-label="Progress">
    {Array.from({ length: total }, (_, i) => (
      <span key={i} className="h-1.5 rounded-full transition-all duration-500" style={{ width: i === value ? 28 : 12, background: 'var(--p-accent)', opacity: i <= value ? 1 : 0.25 }} />
    ))}
  </div>
)
