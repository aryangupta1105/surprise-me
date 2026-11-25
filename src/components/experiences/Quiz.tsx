'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { useState } from 'react'
import type { StoredContent } from '@/lib/schemas'
import { Progress, type ExpProps } from '@/engine/player/shared'

type Content = Extract<StoredContent, { type: 'quiz' }>

export function Quiz({ content, onProgress, onDone, celebrate }: ExpProps<Content>) {
  const [idx, setIdx] = useState(0)
  const [picked, setPicked] = useState<number | null>(null)
  const [score, setScore] = useState(0)
  const [finished, setFinished] = useState(false)
  const total = content.questions.length
  const q = content.questions[idx]

  const pick = (i: number) => {
    if (picked !== null) return
    setPicked(i)
    if (i === q.correctIndex) setScore((s) => s + 1)
    onProgress((idx + 1) / total)
  }
  const next = () => {
    if (idx === total - 1) {
      setFinished(true)
      if (score / total >= 0.6) celebrate()
      return
    }
    setIdx(idx + 1)
    setPicked(null)
  }
  const replay = () => {
    setIdx(0)
    setPicked(null)
    setScore(0)
    setFinished(false)
  }

  if (finished) {
    const ratio = score / total
    const msg = ratio >= 0.75 ? content.results.high : ratio >= 0.4 ? content.results.medium : content.results.low
    return (
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="p-card rounded-[2rem] p-8 text-center shadow-xl">
        <p className="text-sm font-bold uppercase tracking-widest opacity-70">Your score</p>
        <p className="font-display text-7xl mt-2 p-accent">{score}<span className="text-3xl opacity-60">/{total}</span></p>
        <p className="mt-5 text-lg whitespace-pre-line">{msg}</p>
        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <button onClick={onDone} className="p-btn h-12 px-8 rounded-full font-bold active:scale-95 transition">One last thing →</button>
          <button onClick={replay} className="h-12 px-8 rounded-full font-bold ring-1 ring-current/20 opacity-80 hover:opacity-100">Play again</button>
        </div>
      </motion.div>
    )
  }

  return (
    <div className="pt-4">
      <Progress value={idx} total={total} />
      <AnimatePresence mode="wait">
        <motion.div key={idx} initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} className="mt-6">
          <p className="text-center text-sm font-bold uppercase tracking-widest opacity-70">Question {idx + 1}</p>
          <h2 className="font-display text-3xl text-center mt-2 text-balance leading-tight">{q.question}</h2>
          <div className="mt-7 grid gap-3" role="radiogroup" aria-label="Answers">
            {q.options.map((opt, i) => {
              const state = picked === null ? 'idle' : i === q.correctIndex ? 'right' : i === picked ? 'wrong' : 'dim'
              return (
                <motion.button
                  key={i}
                  role="radio"
                  aria-checked={picked === i}
                  onClick={() => pick(i)}
                  whileTap={{ scale: 0.97 }}
                  animate={state === 'wrong' ? { x: [0, -8, 8, -4, 0] } : {}}
                  className={`p-card text-left rounded-2xl px-5 py-4 font-semibold shadow transition ring-2 ${
                    state === 'right' ? 'ring-[#3aa864] bg-[#e5f8eb]! text-[#174d2a]!' : state === 'wrong' ? 'ring-[#e0566b] bg-[#fde8eb]! text-[#6b1424]!' : state === 'dim' ? 'ring-transparent opacity-50' : 'ring-transparent hover:ring-[var(--p-accent)]'
                  }`}
                >
                  <span className="opacity-50 mr-3">{'ABCD'[i]}</span>
                  {opt}
                  {state === 'right' && <span className="float-right" aria-label="correct">✓</span>}
                </motion.button>
              )
            })}
          </div>
          {picked !== null && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-6 text-center" role="status">
              <p className="font-bold text-lg">{picked === q.correctIndex ? 'Correct! 🎉' : 'Not quite! 😅'}</p>
              <p className="mt-2 opacity-90 whitespace-pre-line">{q.reveal}</p>
              <button onClick={next} className="p-btn mt-5 h-12 px-8 rounded-full font-bold active:scale-95 transition">{idx === total - 1 ? 'See my score' : 'Next →'}</button>
            </motion.div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
