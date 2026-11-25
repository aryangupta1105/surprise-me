'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState } from 'react'

// A looping, illustrative phone showing what a recipient sees. Sample copy, not real user data.
const SCREENS = [
  { palette: 'sunrise', kicker: 'Clue 2 of 4', title: 'Where we got lost looking for a beach that didn’t exist 🌴', cta: 'Unlock' },
  { palette: 'blossom', kicker: 'Open when…', title: 'you can’t sleep 🌙', cta: 'Open letter' },
  { palette: 'lagoon', kicker: 'Question 3', title: 'What did I order on our very first date?', cta: 'A · B · C · D' },
  { palette: 'candy', kicker: 'Tap the box…', title: '🎁', cta: 'Harder!' },
] as const

export function HeroPreview() {
  const [i, setI] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setI((x) => (x + 1) % SCREENS.length), 3200)
    return () => clearInterval(t)
  }, [])
  const s = SCREENS[i]
  return (
    <div className="relative mx-auto w-[280px] sm:w-[300px]" aria-hidden>
      <div className="absolute -inset-10 rounded-full bg-gradient-to-br from-peach/50 via-blush/40 to-lilac/40 blur-3xl" />
      <div className="relative rounded-[2.6rem] bg-ink p-2.5 shadow-[var(--shadow-lift)] rotate-[3deg]">
        <div className="relative h-[540px] rounded-[2.1rem] overflow-hidden">
          <AnimatePresence mode="popLayout">
            <motion.div key={i} data-palette={s.palette} initial={{ opacity: 0, scale: 1.08 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.7 }} className="absolute inset-0 flex flex-col items-center justify-center p-7 text-center">
              <p className="text-[11px] font-bold uppercase tracking-[0.25em] opacity-70">{s.kicker}</p>
              <motion.p initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.25 }} className={`font-display mt-4 leading-tight ${s.title.length < 4 ? 'text-8xl' : 'text-[1.7rem]'}`}>
                {s.title}
              </motion.p>
              <motion.span initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.5 }} className="p-btn mt-8 rounded-full px-6 py-3 font-bold text-sm shadow">
                {s.cta}
              </motion.span>
            </motion.div>
          </AnimatePresence>
          <div className="absolute top-2.5 left-1/2 -translate-x-1/2 h-6 w-24 rounded-full bg-ink" />
        </div>
      </div>
      <motion.div animate={{ y: [0, -10, 0] }} transition={{ repeat: Infinity, duration: 4 }} className="absolute -left-14 top-24 rounded-2xl bg-white px-4 py-3 shadow-[var(--shadow-soft)] ring-1 ring-line text-sm font-semibold -rotate-6">
        💌 Maya opened your surprise
      </motion.div>
      <motion.div animate={{ y: [0, 10, 0] }} transition={{ repeat: Infinity, duration: 5 }} className="absolute -right-10 bottom-20 rounded-2xl bg-white px-4 py-3 shadow-[var(--shadow-soft)] ring-1 ring-line text-sm font-semibold rotate-6">
        🎉 Completed 100%
      </motion.div>
    </div>
  )
}
