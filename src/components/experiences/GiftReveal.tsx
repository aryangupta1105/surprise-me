'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import type { StoredContent } from '@/lib/schemas'
import type { ExpProps } from './Experience'

type Content = Extract<StoredContent, { type: 'gift_reveal' }>
const TAPS_TO_OPEN = 3

export function GiftReveal({ content, photo, onProgress, onDone, celebrate }: ExpProps<Content>) {
  const [line, setLine] = useState(0)
  const [phase, setPhase] = useState<'tease' | 'box' | 'stages' | 'gift'>('tease')
  const [taps, setTaps] = useState(0)
  const [stage, setStage] = useState(0)
  const total = content.anticipation.length + content.stages.length + 2

  useEffect(() => {
    if (phase !== 'tease') return
    const t = setTimeout(() => {
      if (line < content.anticipation.length - 1) setLine(line + 1)
      else setPhase('box')
    }, 2200)
    return () => clearTimeout(t)
  }, [phase, line, content.anticipation.length])

  useEffect(() => {
    const steps = phase === 'tease' ? line : phase === 'box' ? content.anticipation.length : phase === 'stages' ? content.anticipation.length + 1 + stage : total - 1
    onProgress(steps / total)
  }, [phase, line, stage, total, content.anticipation.length, onProgress])

  const tap = () => {
    if (taps + 1 >= TAPS_TO_OPEN) {
      setPhase('stages')
      celebrate()
    }
    setTaps(taps + 1)
  }
  const src = photo(content.giftPhotoId)

  return (
    <div className="min-h-[60vh] grid place-items-center text-center">
      <AnimatePresence mode="wait">
        {phase === 'tease' && (
          <motion.p key={`l${line}`} initial={{ opacity: 0, y: 20, filter: 'blur(6px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} exit={{ opacity: 0, y: -20 }} className="font-display text-3xl sm:text-4xl text-balance px-2" onClick={() => setPhase('box')}>
            {content.anticipation[line]}
          </motion.p>
        )}
        {phase === 'box' && (
          <motion.div key="box" initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.4 }}>
            <button onClick={tap} aria-label={`Tap the gift to open it (${TAPS_TO_OPEN - taps} more)`} className="relative block mx-auto">
              <motion.div key={taps} animate={{ rotate: [0, -8, 8, -5, 5, 0], scale: [1, 1.06, 1] }} transition={{ duration: 0.5 }} className="relative">
                <motion.div animate={{ y: taps * -6, rotate: taps * -4 }} className="relative z-10 mx-auto w-52 h-12 rounded-xl p-btn shadow-lg">
                  <span className="absolute left-1/2 -translate-x-1/2 -top-8 text-5xl" aria-hidden>🎀</span>
                </motion.div>
                <div className="mx-auto w-44 h-40 rounded-b-2xl shadow-2xl relative" style={{ background: 'var(--p-accent)', filter: 'brightness(0.92)' }}>
                  <span className="absolute left-1/2 -translate-x-1/2 inset-y-0 w-6 bg-white/50" />
                </div>
              </motion.div>
            </button>
            <p className="mt-8 font-hand text-2xl">{taps === 0 ? 'Tap the box…' : taps === 1 ? 'Harder!' : 'One more!'}</p>
          </motion.div>
        )}
        {phase === 'stages' && (
          <motion.div key={`s${stage}`} initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -30 }} className="p-card rounded-[2rem] p-8 shadow-xl max-w-md">
            <p className="text-xs font-bold uppercase tracking-[0.25em] p-accent">{content.stages[stage].label}</p>
            <p className="mt-4 text-xl leading-relaxed whitespace-pre-line">{content.stages[stage].message}</p>
            <button
              onClick={() => (stage < content.stages.length - 1 ? setStage(stage + 1) : (setPhase('gift'), celebrate()))}
              className="p-btn mt-7 h-12 px-8 rounded-full font-bold active:scale-95 transition"
            >
              {stage < content.stages.length - 1 ? 'And…?' : 'Reveal it! 🎁'}
            </button>
          </motion.div>
        )}
        {phase === 'gift' && (
          <motion.div key="gift" initial={{ opacity: 0, scale: 0.5, rotate: -6 }} animate={{ opacity: 1, scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 120, damping: 12 }} className="p-card rounded-[2rem] overflow-hidden shadow-2xl max-w-md">
            {src && (
              // eslint-disable-next-line @next/next/no-img-element -- private, auth-checked bytes
              <img src={src} alt="" className="w-full aspect-square object-cover" />
            )}
            <div className="p-8">
              <h2 className="font-display text-4xl text-balance">{content.gift.title}</h2>
              <p className="mt-4 text-lg leading-relaxed whitespace-pre-line">{content.gift.message}</p>
              <button onClick={onDone} className="p-btn mt-7 h-12 px-8 rounded-full font-bold active:scale-95 transition">💝</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
