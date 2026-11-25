'use client'

import confetti from 'canvas-confetti'
import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { Cards } from '@/components/experiences/Cards'
import { GiftReveal } from '@/components/experiences/GiftReveal'
import { MemoryJourney } from '@/components/experiences/MemoryJourney'
import { OpenWhen } from '@/components/experiences/OpenWhen'
import { Quiz } from '@/components/experiences/Quiz'
import { TreasureHunt } from '@/components/experiences/TreasureHunt'
import type { BlockProps, BlockType } from '../blocks'
import type { ExpProps } from './shared'

// Trusted renderers, one per registered block type. Text is always rendered as text (never HTML).

export type BlockContext = Omit<ExpProps<unknown>, 'content'> & { motion: 'full' | 'gentle' | 'off' }
type R<T extends BlockType> = (p: { props: BlockProps<T>; ctx: BlockContext }) => React.ReactNode

const Img = ({ src, alt, className }: { src: string | null; alt: string; className: string }) =>
  // eslint-disable-next-line @next/next/no-img-element -- private, access-checked media; no optimizer
  src ? <img src={src} alt={alt} className={className} /> : <div className={`${className} grid place-items-center bg-black/5 text-3xl`} aria-hidden>🖼️</div>

const heading: R<'heading'> = ({ props }) => (
  <div className="text-center">
    {props.kicker && <p className="text-xs font-bold tracking-[0.3em] uppercase opacity-70">{props.kicker}</p>}
    <h2 className={`font-display leading-[1.05] mt-3 text-balance ${props.size === 'xl' ? 'text-4xl sm:text-5xl' : props.size === 'lg' ? 'text-3xl sm:text-4xl' : 'text-2xl'}`}>{props.text}</h2>
  </div>
)
const paragraph: R<'paragraph'> = ({ props }) => <p className="text-lg text-center opacity-85 whitespace-pre-line text-balance">{props.text}</p>
const handwritten: R<'handwritten'> = ({ props }) => <p className="font-hand text-2xl leading-snug text-center whitespace-pre-line">{props.text}</p>
const quote: R<'quote'> = ({ props }) => (
  <figure className="p-card rounded-3xl p-7 shadow-lg text-center">
    <blockquote className="font-display text-2xl leading-snug">“{props.text}”</blockquote>
    {props.by && <figcaption className="mt-3 text-sm opacity-70">— {props.by}</figcaption>}
  </figure>
)
const letter: R<'letter'> = ({ props }) => (
  <article className="rounded-[1.5rem] bg-[#fffdf7] text-[#2b2320] shadow-xl p-8 sm:p-10" style={{ backgroundImage: 'repeating-linear-gradient(transparent 0 31px, #efe4d3 31px 32px)' }}>
    {props.greeting && <p className="font-hand text-2xl leading-8">{props.greeting}</p>}
    <p className="font-hand text-[1.45rem] leading-8 mt-2 whitespace-pre-line">{props.body}</p>
    {props.signoff && <p className="font-hand text-2xl leading-8 mt-4 text-right">{props.signoff}</p>}
  </article>
)
const image: R<'image'> = ({ props, ctx }) => (
  <figure className="p-card rounded-3xl overflow-hidden shadow-lg">
    <Img src={ctx.photo(props.photoId)} alt={props.alt} className="w-full aspect-[4/3] object-cover" />
    {props.caption && <figcaption className="p-4 text-center font-hand text-xl">{props.caption}</figcaption>}
  </figure>
)
const Gallery: R<'gallery'> = ({ props, ctx }) => {
  const [i, setI] = useState(0)
  if (!props.items.length) return null
  if (props.layout === 'slideshow') {
    const it = props.items[i % props.items.length]
    return (
      <div className="p-card rounded-3xl overflow-hidden shadow-lg">
        <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <Img src={ctx.photo(it.photoId)} alt={it.alt} className="w-full aspect-[4/3] object-cover" />
        </motion.div>
        <div className="flex items-center justify-between p-3">
          <button onClick={() => setI((i - 1 + props.items.length) % props.items.length)} className="size-10 rounded-full hover:bg-black/5" aria-label="Previous photo">←</button>
          <span className="font-hand text-xl text-center">{it.caption}</span>
          <button onClick={() => setI(i + 1)} className="size-10 rounded-full hover:bg-black/5" aria-label="Next photo">→</button>
        </div>
      </div>
    )
  }
  const polaroid = props.layout === 'polaroid'
  return (
    <div className={`grid gap-4 ${props.items.length > 1 ? 'grid-cols-2' : ''}`}>
      {props.items.map((it, n) => (
        <motion.figure key={n} initial={{ opacity: 0, y: 20, rotate: 0 }} whileInView={{ opacity: 1, y: 0, rotate: polaroid ? (n % 2 ? 2.5 : -2.5) : 0 }} viewport={{ once: true }} className={polaroid ? 'bg-white p-2.5 pb-3 shadow-xl text-[#2b2320]' : 'rounded-2xl overflow-hidden shadow-lg p-card'}>
          <Img src={ctx.photo(it.photoId)} alt={it.alt} className="w-full aspect-square object-cover" />
          {it.caption && <figcaption className={`text-center ${polaroid ? 'font-hand text-lg mt-1.5' : 'p-2 text-sm'}`}>{it.caption}</figcaption>}
        </motion.figure>
      ))}
    </div>
  )
}
// Native controls: accessible, keyboard-friendly, and they play on every phone without extra code.
const audio: R<'audio'> = ({ props, ctx }) => {
  const src = ctx.photo(props.audioId)
  return (
    <figure className="p-card rounded-3xl p-6 shadow-lg text-center space-y-3">
      <div className="text-4xl" aria-hidden>🎵</div>
      {props.title && <figcaption className="font-display text-2xl">{props.title}</figcaption>}
      {src ? <audio src={src} controls preload="metadata" className="w-full" /> : <p className="text-sm opacity-60">Audio coming soon</p>}
      {props.note && <p className="font-hand text-xl opacity-85">{props.note}</p>}
    </figure>
  )
}
const video: R<'video'> = ({ props, ctx }) => {
  const src = ctx.photo(props.videoId)
  return (
    <figure className="p-card rounded-3xl overflow-hidden shadow-lg">
      {src ? <video src={src} controls playsInline preload="metadata" className="w-full max-h-[70vh] bg-black" /> : <div className="aspect-video grid place-items-center bg-black/5 text-3xl" aria-hidden>🎬</div>}
      {props.caption && <figcaption className="p-4 text-center font-hand text-xl">{props.caption}</figcaption>}
    </figure>
  )
}
const ConfettiBurst: R<'confetti'> = ({ props, ctx }) => {
  useEffect(() => {
    if (ctx.motion === 'off' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    confetti({ particleCount: props.intensity === 'full' && ctx.motion === 'full' ? 160 : 60, spread: 90, origin: { y: 0.6 } })
  }, [props.intensity, ctx.motion])
  return null
}

// Interactive blocks reuse the original experience components; their `content` is the block's props.
const exp = <T extends BlockType>(C: (p: ExpProps<never>) => React.ReactNode): R<T> =>
  function Interactive({ props, ctx }) {
    return <C content={props as never} photo={ctx.photo} onProgress={ctx.onProgress} onDone={ctx.onDone} celebrate={ctx.celebrate} />
  }

export const RENDERERS: { [T in BlockType]: R<T> } = {
  heading, paragraph, handwritten, quote, letter, image, gallery: Gallery, audio, video, confetti: ConfettiBurst,
  treasure_hunt: exp(TreasureHunt), timeline: exp(MemoryJourney), quiz: exp(Quiz), gift_reveal: exp(GiftReveal), cards: exp(Cards), open_when: exp(OpenWhen),
}
