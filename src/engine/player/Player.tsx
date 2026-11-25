'use client'

import confetti from 'canvas-confetti'
import { AnimatePresence, MotionConfig, motion, type Variants } from 'framer-motion'
import { useCallback, useRef, useState } from 'react'
import { BLOCKS, isInteractive } from '../blocks'
import type { Block, SurpriseDoc } from '../doc'
import { RENDERERS, type BlockContext } from './renderers'

const TRANSITIONS: Record<string, Variants> = {
  fade: { in: { opacity: 0 }, on: { opacity: 1 }, out: { opacity: 0 } },
  slide: { in: { opacity: 0, x: 60 }, on: { opacity: 1, x: 0 }, out: { opacity: 0, x: -60 } },
  zoom: { in: { opacity: 0, scale: 0.9 }, on: { opacity: 1, scale: 1 }, out: { opacity: 0, scale: 1.05 } },
  flip: { in: { opacity: 0, rotateY: -70 }, on: { opacity: 1, rotateY: 0 }, out: { opacity: 0, rotateY: 70 } },
  none: { in: {}, on: {}, out: {} },
}

type Props = {
  doc: SurpriseDoc
  photo: (id?: string) => string | null
  onProgress?: (percent: number) => void
  /** Where to remember the recipient's place so a refresh resumes (omit in previews). */
  resumeKey?: string
  /** Inside the editor: bounded height, no resume. */
  preview?: boolean
  /** Scene to open on (editor preview follows the scene being edited). */
  startAt?: number
}

function readResume(key?: string) {
  if (!key) return 0
  try {
    return Number(localStorage.getItem(key)) || 0
  } catch {
    return 0
  }
}

/** Plays a scene document: one scene at a time, with transitions, progress and resume. */
export function Player({ doc, photo, onProgress, resumeKey, preview, startAt }: Props) {
  const total = doc.scenes.length
  const [index, setIndex] = useState(() => Math.min(startAt ?? readResume(resumeKey), total - 1))
  const best = useRef(0)
  const motionLevel = doc.theme.motion
  const scene = doc.scenes[index]
  const last = index === total - 1
  // The server strips the blocks of a scene that is still locked, so an empty scene with unlockAt is locked.
  const locked = Boolean(scene.unlockAt && !scene.blocks.length)
  const hasInteractive = scene.blocks.some((b) => isInteractive(b.type))

  const report = useCallback(
    (pct: number) => {
      const v = Math.round(Math.max(0, Math.min(100, pct)))
      if (v > best.current) {
        best.current = v
        onProgress?.(v)
      }
    },
    [onProgress],
  )

  const go = useCallback(
    (to: number) => {
      const next = Math.max(0, Math.min(total - 1, to))
      setIndex(next)
      try {
        if (resumeKey) localStorage.setItem(resumeKey, String(next))
      } catch {}
      report((next / Math.max(1, total - 1)) * 100)
      if (!preview) window.scrollTo({ top: 0, behavior: 'smooth' })
    },
    [total, resumeKey, report, preview],
  )

  const celebrate = useCallback(() => {
    if (motionLevel === 'off' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    confetti({ particleCount: motionLevel === 'gentle' ? 60 : 140, spread: 90, origin: { y: 0.6 } })
  }, [motionLevel])

  const ctx: BlockContext = {
    photo,
    motion: motionLevel,
    celebrate,
    // Interactive blocks report progress within their scene and move on when finished.
    onProgress: (f) => report(((index + Math.max(0, Math.min(1, f))) / Math.max(1, total - 1)) * 100),
    onDone: () => go(index + 1),
  }

  const variants = TRANSITIONS[motionLevel === 'off' ? 'none' : scene.transition] ?? TRANSITIONS.fade

  return (
    <MotionConfig reducedMotion={motionLevel === 'off' ? 'always' : 'user'}>
      <div data-palette={scene.palette ?? doc.theme.palette} className={`relative overflow-hidden transition-[background] duration-700 ${preview ? 'min-h-[640px] rounded-[1.75rem]' : 'min-h-dvh'}`}>
        {total > 1 && (
          <div className="absolute top-0 inset-x-0 z-20 h-1 bg-black/5" aria-hidden>
            <div className="h-full transition-all duration-500" style={{ width: `${((index + 1) / total) * 100}%`, background: 'var(--p-accent)' }} />
          </div>
        )}
        {index > 0 && (
          <button onClick={() => go(index - 1)} className="absolute top-4 left-4 z-20 size-10 rounded-full bg-black/5 hover:bg-black/10 grid place-items-center" aria-label="Previous scene">←</button>
        )}
        <div className="relative z-10 mx-auto max-w-xl px-5 py-12 sm:py-16 [perspective:1200px]">
          <AnimatePresence mode="wait">
            <motion.section key={scene.id} variants={variants} initial="in" animate="on" exit="out" transition={{ duration: motionLevel === 'gentle' ? 0.7 : 0.45 }} aria-label={scene.title || `Scene ${index + 1}`} className="space-y-6">
              {locked ? (
                <div className="p-card rounded-[2rem] p-10 text-center shadow-xl">
                  <div className="text-5xl" aria-hidden>🔒</div>
                  <p className="font-display text-2xl mt-4">This part opens {new Date(scene.unlockAt!).toLocaleString(undefined, { dateStyle: 'long', timeStyle: 'short' })}</p>
                  <p className="opacity-70 mt-2">Come back then — it will be worth it.</p>
                </div>
              ) : (
                scene.blocks.map((b) => <BlockView key={b.id} block={b} ctx={ctx} />)
              )}
              <SceneNav
                kind={scene.kind}
                first={index === 0}
                last={last}
                waiting={hasInteractive && !locked}
                onNext={() => go(index + 1)}
                onRestart={() => {
                  go(0)
                  best.current = 0
                }}
              />
            </motion.section>
          </AnimatePresence>
        </div>
      </div>
    </MotionConfig>
  )
}

function BlockView({ block, ctx }: { block: Block; ctx: BlockContext }) {
  const Render = RENDERERS[block.type] as (p: { props: unknown; ctx: BlockContext }) => React.ReactNode
  const parsed = BLOCKS[block.type].schema.safeParse(block.props)
  if (!parsed.success) return null // never render something that fails its schema
  return <Render props={parsed.data} ctx={ctx} />
}

function SceneNav({ kind, first, last, waiting, onNext, onRestart }: { kind: string; first: boolean; last: boolean; waiting: boolean; onNext: () => void; onRestart: () => void }) {
  if (last)
    return (
      <div className="text-center pt-4">
        <button onClick={onRestart} className="text-sm font-semibold underline underline-offset-4 opacity-70 hover:opacity-100">Experience it again</button>
      </div>
    )
  if (waiting) return null // the interactive block moves on by itself when finished
  return (
    <div className="text-center pt-4">
      <button onClick={onNext} className="p-btn h-14 px-10 rounded-full font-bold text-lg shadow-lg active:scale-95 transition">
        {first || kind === 'opening' ? 'Let’s begin ✨' : 'Continue →'}
      </button>
    </div>
  )
}
