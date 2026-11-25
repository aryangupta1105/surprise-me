'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { useState } from 'react'
import type { StoredContent } from '@/lib/schemas'
import type { ExpProps } from '@/engine/player/shared'

type Content = Extract<StoredContent, { type: 'open_when' }>

export function OpenWhen({ content, onProgress, onDone }: ExpProps<Content>) {
  const [opened, setOpened] = useState<Set<number>>(new Set())
  const [reading, setReading] = useState<number | null>(null)
  // Locked letters arrive without their text (the server strips it), so this is display only.
  const [now] = useState(() => Date.now())
  const locked = (i: number) => {
    const at = content.letters[i].unlockAt
    return at && new Date(at).getTime() > now ? new Date(at) : null
  }

  const open = (i: number) => {
    if (locked(i)) return
    const next = new Set(opened).add(i)
    setOpened(next)
    setReading(i)
    onProgress(next.size / (content.letters.length + 1))
  }

  return (
    <div className="pt-2">
      <h2 className="font-display text-3xl text-center">Letters for you</h2>
      <p className="text-center opacity-75 mt-2">Open each one when the moment comes. (Or right now. I won’t tell.)</p>
      <div className="grid grid-cols-2 gap-4 mt-8">
        {content.letters.map((l, i) => {
          const lock = locked(i)
          return (
            <motion.button
              key={i}
              onClick={() => open(i)}
              whileHover={lock ? {} : { y: -6, rotate: i % 2 ? 1.5 : -1.5 }}
              whileTap={{ scale: 0.96 }}
              aria-label={`${l.when}${lock ? `, unlocks ${lock.toLocaleDateString()}` : ''}`}
              className={`relative min-h-36 rounded-2xl p-card shadow-lg overflow-hidden text-left p-4 pt-16 flex flex-col justify-end ${lock ? 'opacity-60' : ''}`}
            >
              {/* envelope flap */}
              <span aria-hidden className="absolute inset-x-0 top-0 h-1/2 origin-top" style={{ background: 'var(--p-accent)', opacity: opened.has(i) ? 0.12 : 0.22, clipPath: 'polygon(0 0, 100% 0, 50% 100%)', height: '3.5rem' }} />
              <span aria-hidden className="absolute top-3 left-1/2 -translate-x-1/2 text-2xl">{lock ? '🔒' : opened.has(i) ? '💌' : l.emoji || '✉️'}</span>
              <span className="relative font-semibold leading-tight text-[15px]">{l.when}</span>
              {lock && <span className="relative text-xs opacity-70 mt-1">Opens {lock.toLocaleDateString()}</span>}
            </motion.button>
          )
        })}
      </div>
      {opened.size > 0 && (
        <div className="text-center mt-10">
          <button onClick={onDone} className="p-btn h-12 px-8 rounded-full font-bold active:scale-95 transition">A final note →</button>
        </div>
      )}
      <AnimatePresence>
        {reading !== null && (
          <motion.div className="fixed inset-0 z-40 grid place-items-center p-4 bg-black/40 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setReading(null)}>
            <motion.article
              role="dialog"
              aria-modal
              aria-label={content.letters[reading].when}
              onClick={(e) => e.stopPropagation()}
              initial={{ y: 120, scale: 0.85, rotate: -3 }}
              animate={{ y: 0, scale: 1, rotate: 0 }}
              exit={{ y: 80, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 140, damping: 18 }}
              className="w-full max-w-lg max-h-[85dvh] overflow-auto rounded-[1.5rem] bg-[#fffdf7] text-[#2b2320] shadow-2xl p-8 sm:p-10"
              style={{ backgroundImage: 'repeating-linear-gradient(transparent 0 31px, #efe4d3 31px 32px)' }}
            >
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#a0705a]">{content.letters[reading].when}</p>
              <p className="font-hand text-[1.55rem] leading-8 mt-4 whitespace-pre-line">{content.letters[reading].letter}</p>
              <button onClick={() => setReading(null)} className="mt-6 h-11 px-6 rounded-full font-bold bg-[#2b2320] text-white">Fold it back</button>
            </motion.article>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
