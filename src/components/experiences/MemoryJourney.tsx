'use client'

import { motion } from 'framer-motion'
import { useRef } from 'react'
import type { StoredContent } from '@/lib/schemas'
import type { ExpProps } from './Experience'

type Content = Extract<StoredContent, { type: 'memory_journey' }>

export function MemoryJourney({ content, photo, onProgress, onDone }: ExpProps<Content>) {
  const seen = useRef(new Set<number>())
  return (
    <div className="relative pt-2">
      <div aria-hidden className="absolute left-5 sm:left-1/2 top-0 bottom-24 w-0.5 -translate-x-1/2" style={{ background: 'linear-gradient(var(--p-accent), transparent)', opacity: 0.4 }} />
      <ol className="space-y-12">
        {content.moments.map((m, i) => {
          const src = photo(m.photoId)
          const left = i % 2 === 0
          return (
            <motion.li
              key={i}
              initial={{ opacity: 0, y: 40, x: left ? -20 : 20 }}
              whileInView={{ opacity: 1, y: 0, x: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              onViewportEnter={() => {
                seen.current.add(i)
                onProgress(seen.current.size / (content.moments.length + 1))
              }}
              transition={{ type: 'spring', stiffness: 80, damping: 16 }}
              className={`relative pl-12 sm:pl-0 sm:w-[calc(50%-1.5rem)] ${left ? 'sm:mr-auto' : 'sm:ml-auto'}`}
            >
              <span aria-hidden className={`absolute top-4 left-5 sm:left-auto ${left ? 'sm:-right-[1.95rem]' : 'sm:-left-[1.95rem]'} -translate-x-1/2 sm:translate-x-0 size-9 rounded-full p-btn grid place-items-center text-lg shadow-md`}>
                {m.emoji || '✨'}
              </span>
              <article className="p-card rounded-3xl overflow-hidden shadow-lg">
                {src && (
                  // eslint-disable-next-line @next/next/no-img-element -- private, auth-checked bytes; no optimizer
                  <img src={src} alt="" className="w-full aspect-[4/3] object-cover" />
                )}
                <div className="p-6">
                  {m.dateLabel && <p className="text-xs font-bold uppercase tracking-widest p-accent">{m.dateLabel}</p>}
                  <h3 className="font-display text-2xl mt-1">{m.heading}</h3>
                  <p className="mt-3 leading-relaxed whitespace-pre-line opacity-90">{m.story}</p>
                </div>
              </article>
            </motion.li>
          )
        })}
      </ol>
      <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="text-center mt-16">
        <p className="font-hand text-2xl">…and there’s one more thing.</p>
        <button onClick={onDone} className="p-btn mt-5 h-14 px-10 rounded-full font-bold text-lg shadow-lg active:scale-95 transition">Read my message 💌</button>
      </motion.div>
    </div>
  )
}
