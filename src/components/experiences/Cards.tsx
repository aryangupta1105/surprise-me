'use client'

import { AnimatePresence, motion, type PanInfo } from 'framer-motion'
import { useState } from 'react'
import type { StoredContent } from '@/lib/schemas'
import { Progress, type ExpProps } from '@/engine/player/shared'

type Content = Extract<StoredContent, { type: 'cards' }>

export function Cards({ content, onProgress, onDone }: ExpProps<Content>) {
  const [idx, setIdx] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [dir, setDir] = useState(1)
  const total = content.cards.length
  const finished = idx >= total

  const go = (d: number) => {
    const n = Math.max(0, Math.min(total, idx + d))
    setDir(d)
    setIdx(n)
    setFlipped(false)
    onProgress(n / (total + 1))
  }
  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x < -80 || info.velocity.x < -400) go(1)
    else if (info.offset.x > 80 || info.velocity.x > 400) go(-1)
  }
  const share = async () => {
    const text = `${content.deckTitle}\n\n${content.cards.map((c) => `${c.emoji} ${c.heading}`).join('\n')}`
    if (navigator.share) await navigator.share({ title: content.deckTitle, text }).catch(() => {})
    else await navigator.clipboard.writeText(text)
  }

  return (
    <div className="pt-2">
      <h2 className="font-display text-3xl text-center text-balance">{content.deckTitle}</h2>
      <div className="mt-4"><Progress value={Math.min(idx, total - 1)} total={total} /></div>
      <div className="relative h-[440px] mt-8 [perspective:1200px]">
        {/* the next card peeking underneath */}
        {!finished && idx < total - 1 && <div aria-hidden className="absolute inset-x-6 top-4 bottom-0 rounded-[2rem] p-card opacity-50 rotate-2 shadow" />}
        <AnimatePresence custom={dir} mode="popLayout">
          {!finished ? (
            <motion.div
              key={idx}
              custom={dir}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              onDragEnd={onDragEnd}
              initial={{ x: dir * 300, opacity: 0, rotate: dir * 8 }}
              animate={{ x: 0, opacity: 1, rotate: 0 }}
              exit={{ x: -dir * 300, opacity: 0, rotate: -dir * 10 }}
              transition={{ type: 'spring', stiffness: 220, damping: 24 }}
              className="absolute inset-0 cursor-grab active:cursor-grabbing"
            >
              <button
                onClick={() => setFlipped(!flipped)}
                aria-label={flipped ? 'Show front' : 'Reveal card'}
                className="relative size-full [transform-style:preserve-3d] transition-transform duration-700"
                style={{ transform: flipped ? 'rotateY(180deg)' : 'none' }}
              >
                <div className="absolute inset-0 p-card rounded-[2rem] shadow-xl grid place-items-center p-8 [backface-visibility:hidden]">
                  <div>
                    <div className="text-7xl" aria-hidden>{content.cards[idx].emoji}</div>
                    <h3 className="font-display text-3xl mt-6 text-balance">{content.cards[idx].heading}</h3>
                    <p className="mt-6 text-sm font-semibold opacity-60">Tap to reveal</p>
                  </div>
                </div>
                <div className="absolute inset-0 rounded-[2rem] shadow-xl grid place-items-center p-8 [backface-visibility:hidden] p-btn" style={{ transform: 'rotateY(180deg)' }}>
                  <p className="text-xl leading-relaxed font-semibold whitespace-pre-line">{content.cards[idx].body}</p>
                </div>
              </button>
            </motion.div>
          ) : (
            <motion.div key="final" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="absolute inset-0 p-card rounded-[2rem] shadow-xl p-8 flex flex-col justify-center text-center">
              <p className="text-xs font-bold uppercase tracking-widest opacity-60">The whole deck</p>
              <ul className="mt-4 space-y-2 text-left max-h-60 overflow-auto">
                {content.cards.map((c, i) => <li key={i} className="font-semibold">{c.emoji} {c.heading}</li>)}
              </ul>
              <div className="mt-6 flex gap-3 justify-center">
                <button onClick={share} className="h-11 px-5 rounded-full font-bold ring-1 ring-current/20">Share ↗</button>
                <button onClick={onDone} className="p-btn h-11 px-6 rounded-full font-bold">Finish 💝</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      {!finished && (
        <div className="flex justify-between items-center mt-6">
          <button onClick={() => go(-1)} disabled={idx === 0} className="h-11 px-5 rounded-full font-semibold disabled:opacity-30">← Back</button>
          <span className="text-sm opacity-60">Swipe or tap</span>
          <button onClick={() => go(1)} className="p-btn h-11 px-6 rounded-full font-bold">Next →</button>
        </div>
      )}
    </div>
  )
}
