'use client'

import { AnimatePresence, motion, useAnimation } from 'framer-motion'
import { useState } from 'react'
import type { StoredContent } from '@/lib/schemas'
import { Progress, type ExpProps } from '@/engine/player/shared'

type Content = Extract<StoredContent, { type: 'treasure_hunt' }>

const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}]/gu, '')

/** Edit distance ≤ 1 for longer answers, so a typo doesn't block a birthday. */
function close(a: string, b: string) {
  if (a === b) return true
  if (Math.min(a.length, b.length) < 5 || Math.abs(a.length - b.length) > 1) return false
  let i = 0, j = 0, edits = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue }
    if (++edits > 1) return false
    if (a.length > b.length) i++
    else if (b.length > a.length) j++
    else { i++; j++ }
  }
  return edits + (a.length - i) + (b.length - j) <= 1
}

export function isCorrect(guess: string, clue: { answer: string; acceptedAnswers: string[] }) {
  const g = norm(guess)
  return !!g && [clue.answer, ...clue.acceptedAnswers].some((a) => close(g, norm(a)))
}

export function TreasureHunt({ content, onProgress, onDone, celebrate }: ExpProps<Content>) {
  const [idx, setIdx] = useState(0)
  const [guess, setGuess] = useState('')
  const [solved, setSolved] = useState(false)
  const [hint, setHint] = useState(false)
  const [tries, setTries] = useState(0)
  const shake = useAnimation()
  const clue = content.clues[idx]

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (isCorrect(guess, clue)) {
      setSolved(true)
      onProgress((idx + 1) / content.clues.length)
      if (idx < content.clues.length - 1) celebrate()
    } else {
      setTries((t) => t + 1)
      shake.start({ x: [0, -12, 12, -8, 8, 0], transition: { duration: 0.45 } })
    }
  }
  const next = () => {
    if (idx === content.clues.length - 1) return onDone()
    setIdx(idx + 1)
    setGuess('')
    setSolved(false)
    setHint(false)
    setTries(0)
  }

  return (
    <div className="pt-4">
      <Progress value={idx} total={content.clues.length} />
      <p className="text-center text-sm font-bold tracking-widest uppercase opacity-70 mt-6">Clue {idx + 1} of {content.clues.length}</p>
      <AnimatePresence mode="wait">
        <motion.div key={idx} initial={{ opacity: 0, rotateX: -20, y: 30 }} animate={{ opacity: 1, rotateX: 0, y: 0 }} exit={{ opacity: 0, y: -30 }} className="mt-4">
          <motion.div animate={shake} className="p-card rounded-[2rem] p-7 sm:p-9 shadow-xl relative">
            <div className="absolute -top-5 left-1/2 -translate-x-1/2 size-10 rounded-full p-btn grid place-items-center text-xl shadow" aria-hidden>🗝️</div>
            <p className="font-display text-2xl sm:text-[1.7rem] leading-snug text-center whitespace-pre-line pt-3">{clue.riddle}</p>
            {!solved ? (
              <form onSubmit={submit} className="mt-7 space-y-3">
                <label className="sr-only" htmlFor="answer">Your answer</label>
                <input id="answer" value={guess} onChange={(e) => setGuess(e.target.value)} autoComplete="off" placeholder="Your answer…" className="w-full h-14 rounded-2xl px-5 text-lg text-center bg-black/5 outline-none focus:ring-2 ring-[var(--p-accent)]" />
                <button className="p-btn w-full h-14 rounded-2xl font-bold text-lg active:scale-[0.98] transition">Unlock</button>
                {tries > 0 && <p role="status" className="text-center text-sm opacity-75">Not quite — {tries > 1 ? 'maybe try the hint?' : 'try again!'}</p>}
                <div className="text-center">
                  {hint ? (
                    <p className="font-hand text-xl mt-2">💡 {clue.hint}</p>
                  ) : (
                    <button type="button" onClick={() => setHint(true)} className="text-sm font-semibold underline underline-offset-4 opacity-70 hover:opacity-100">Need a hint?</button>
                  )}
                </div>
              </form>
            ) : (
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="mt-7 text-center">
                <p className="text-sm font-bold uppercase tracking-widest p-accent">Unlocked: {clue.answer}</p>
                <p className="mt-3 text-lg whitespace-pre-line">{clue.successMessage}</p>
                <button onClick={next} className="p-btn mt-6 h-13 px-8 py-3 rounded-full font-bold active:scale-95 transition">
                  {idx === content.clues.length - 1 ? 'Open the treasure 🏆' : 'Next clue →'}
                </button>
              </motion.div>
            )}
          </motion.div>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
