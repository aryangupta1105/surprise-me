'use client'

import { motion, useReducedMotion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import type { BlockProps, BlockType } from '../../blocks'
import type { BlockContext } from '../renderers'

// Renderers for the newer blocks (countdown, scratch card, memory match, awards, journey, magazine cover, waveform audio).

type P<T extends BlockType> = { props: BlockProps<T>; ctx: BlockContext }

// eslint-disable-next-line @next/next/no-img-element -- private, access-checked media; no optimizer
const Img = (p: { src: string; alt: string; className: string }) => <img {...p} alt={p.alt} />

// ---------- countdown ----------
export function Countdown({ props }: P<'countdown'>) {
  const target = Date.parse(props.target)
  const [now, setNow] = useState<number | null>(null) // null until mounted: no server/client clock mismatch
  const left = now === null ? null : Math.max(0, target - now)
  useEffect(() => {
    const tick = () => setNow(Date.now())
    const first = setTimeout(tick, 0)
    const t = setInterval(tick, 1000)
    return () => { clearTimeout(first); clearInterval(t) }
  }, [])
  if (left === 0) {
    return (
      <div className="p-card rounded-3xl p-8 shadow-lg text-center" role="status">
        <div className="text-5xl" aria-hidden>🎉</div>
        {props.title && <p className="mt-3 text-sm font-bold tracking-[0.2em] uppercase opacity-70">{props.title}</p>}
        <p className="font-display text-3xl mt-2 text-balance">{props.doneMessage || 'It’s time!'}</p>
      </div>
    )
  }
  const s = Math.floor((left ?? 0) / 1000)
  const parts: [string, number][] = [['days', Math.floor(s / 86400)], ['hours', Math.floor(s / 3600) % 24], ['minutes', Math.floor(s / 60) % 60], ['seconds', s % 60]]
  return (
    <div className="text-center">
      {props.title && <h3 className="font-display text-2xl sm:text-3xl text-balance">{props.title}</h3>}
      <div role="timer" aria-label={left === null ? 'Countdown' : `${parts.map(([u, n]) => `${n} ${u}`).join(', ')} to go`} className="mt-5 grid grid-cols-4 gap-2 sm:gap-3">
        {parts.map(([unit, n]) => (
          <div key={unit} className="p-card rounded-2xl py-4 shadow-lg" aria-hidden>
            <div className="font-display text-3xl sm:text-5xl tabular-nums p-accent">{left === null ? '–' : String(n).padStart(2, '0')}</div>
            <div className="mt-1 text-[0.65rem] sm:text-xs font-bold tracking-[0.2em] uppercase opacity-60">{unit}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ---------- scratch card ----------
export function ScratchReveal({ props, ctx }: P<'scratch_reveal'>) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const [revealed, setRevealed] = useState(false)
  const drawing = useRef(false)
  const moves = useRef(0)
  const photo = ctx.photo(props.photoId)

  useEffect(() => {
    const c = canvas.current
    if (!c || revealed) return
    const dpr = window.devicePixelRatio || 1
    c.width = c.offsetWidth * dpr
    c.height = c.offsetHeight * dpr
    const g = c.getContext('2d')!
    g.scale(dpr, dpr)
    const w = c.offsetWidth, h = c.offsetHeight
    const grad = g.createLinearGradient(0, 0, w, h)
    grad.addColorStop(0, '#d9d9e2'); grad.addColorStop(0.5, '#b4b4c2'); grad.addColorStop(1, '#cfcfd9')
    g.fillStyle = grad
    g.fillRect(0, 0, w, h)
    g.fillStyle = '#5b5b6b'
    g.font = '600 18px system-ui, sans-serif'
    g.textAlign = 'center'
    g.fillText(`✨ ${props.prompt} ✨`, w / 2, h / 2 + 6)
  }, [props.prompt, revealed])

  const reveal = () => {
    if (revealed) return
    setRevealed(true)
    ctx.onProgress(1)
    ctx.celebrate()
  }
  const scratch = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return
    const c = e.currentTarget
    const r = c.getBoundingClientRect()
    const g = c.getContext('2d')!
    g.globalCompositeOperation = 'destination-out'
    g.beginPath()
    g.arc(e.clientX - r.left, e.clientY - r.top, 22, 0, Math.PI * 2)
    g.fill()
    if (++moves.current % 12) return
    // Sample every 16th pixel; reveal once more than half is scratched away.
    const { data } = g.getImageData(0, 0, c.width, c.height)
    let clear = 0, total = 0
    for (let i = 3; i < data.length; i += 64) { total++; if (data[i] === 0) clear++ }
    if (clear / total > 0.5) reveal()
  }

  return (
    <div className="space-y-4 text-center">
      <div className={`relative rounded-3xl overflow-hidden shadow-xl p-card ${photo ? '' : 'min-h-56 grid place-items-center'}`}>
        <div aria-hidden>
          {photo && <Img src={photo} alt="" className="w-full aspect-[4/3] object-cover" />}
          <p className="font-display text-2xl sm:text-3xl p-6 text-balance whitespace-pre-line">{props.hiddenText}</p>
        </div>
        <p className="sr-only" aria-live="polite">{revealed ? props.hiddenText : ''}</p>
        {!revealed && (
          <canvas
            ref={canvas}
            aria-hidden
            className="absolute inset-0 size-full touch-none cursor-crosshair"
            onPointerDown={(e) => { drawing.current = true; e.currentTarget.setPointerCapture(e.pointerId); scratch(e) }}
            onPointerMove={scratch}
            onPointerUp={() => { drawing.current = false }}
            onPointerCancel={() => { drawing.current = false }}
          />
        )}
      </div>
      {revealed
        ? <button onClick={ctx.onDone} className="p-btn rounded-full px-7 py-3 font-semibold shadow-lg">Continue →</button>
        : <button onClick={reveal} className="rounded-full px-5 py-2 text-sm font-semibold underline underline-offset-4 opacity-80 hover:opacity-100">Reveal without scratching</button>}
    </div>
  )
}

// ---------- memory match ----------
const shuffled = <T,>(items: T[], seed: string) => {
  let a = 0
  for (const ch of seed) a = Math.imul(a ^ ch.charCodeAt(0), 2654435761)
  const rand = () => { // mulberry32: deterministic, so server and client render the same deck
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [out[i], out[j]] = [out[j], out[i]] }
  return out
}

function MemoryGame({ props, ctx }: P<'memory_match'>) {
  const n = props.pairs.length
  const [deck] = useState(() => shuffled(props.pairs.flatMap((_, i) => [i, i]), JSON.stringify(props.pairs)))
  const [open, setOpen] = useState<number[]>([])
  const [matched, setMatched] = useState<number[]>([])
  const [moves, setMoves] = useState(0)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])
  const done = matched.length === n
  const flipAnim = ctx.motion === 'off' ? '' : 'transition-transform duration-500 motion-reduce:transition-none'

  const flip = (card: number) => {
    if (open.length === 2 || open.includes(card) || matched.includes(deck[card])) return
    if (!open.length) return setOpen([card])
    setMoves(moves + 1)
    const [first] = open
    if (deck[first] === deck[card]) {
      const m = [...matched, deck[card]]
      setMatched(m)
      setOpen([])
      ctx.onProgress(m.length / n)
      if (m.length === n) ctx.celebrate()
    } else {
      setOpen([first, card])
      timer.current = setTimeout(() => setOpen([]), 900)
    }
  }

  return (
    <div className="text-center">
      {props.title && <h2 className="font-display text-3xl text-balance">{props.title}</h2>}
      <p className="mt-2 text-sm font-semibold opacity-70" aria-live="polite">Moves: {moves} · Pairs: {matched.length}/{n}</p>
      <div className={`mt-5 grid gap-2 sm:gap-3 ${deck.length % 4 ? 'grid-cols-3' : 'grid-cols-4'}`} style={{ perspective: 800 }}>
        {deck.map((pair, i) => {
          const up = open.includes(i) || matched.includes(pair)
          const { emoji, label } = props.pairs[pair]
          return (
            <button
              key={i}
              onClick={() => flip(i)}
              disabled={matched.includes(pair)}
              aria-label={up ? `Card ${i + 1}: ${label || emoji}${matched.includes(pair) ? ', matched' : ''}` : `Card ${i + 1}, face down`}
              className={`relative aspect-[3/4] [transform-style:preserve-3d] ${flipAnim}`}
              style={{ transform: up ? 'rotateY(180deg)' : 'none' }}
            >
              <span className="absolute inset-0 rounded-2xl p-btn shadow-md grid place-items-center text-2xl [backface-visibility:hidden]" aria-hidden>?</span>
              <span className={`absolute inset-0 rounded-2xl p-card shadow-md grid place-items-center content-center gap-1 p-1 [backface-visibility:hidden] ${matched.includes(pair) ? 'ring-2 ring-[var(--p-accent)]' : ''}`} style={{ transform: 'rotateY(180deg)' }} aria-hidden>
                <span className="text-3xl sm:text-4xl">{emoji}</span>
                {label && <span className="text-[0.7rem] sm:text-xs font-semibold leading-tight line-clamp-2">{label}</span>}
              </span>
            </button>
          )
        })}
      </div>
      {done && (
        <div className="mt-6 space-y-3" role="status">
          <p className="font-display text-2xl">All pairs found in {moves} moves! 🎉</p>
          <button onClick={ctx.onDone} className="p-btn rounded-full px-7 py-3 font-semibold shadow-lg">Continue →</button>
        </div>
      )}
    </div>
  )
}
// A new key when the pairs change (in the editor preview) deals a fresh deck.
export const MemoryMatch = (p: P<'memory_match'>) => <MemoryGame key={JSON.stringify(p.props.pairs)} {...p} />

// ---------- awards ----------
export function Awards({ props, ctx }: P<'awards'>) {
  const reduce = useReducedMotion()
  const [shown, setShown] = useState(0)
  const count = ctx.motion === 'off' || reduce ? props.awards.length : shown
  return (
    <div className="text-center">
      {props.title && <h2 className="font-display text-3xl text-balance">{props.title}</h2>}
      <ul className="mt-5 space-y-3">
        {props.awards.slice(0, count).map((a, i) => (
          <motion.li key={i} initial={{ opacity: 0, scale: 0.85, rotate: -2 }} animate={{ opacity: 1, scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 18 }} className="p-card rounded-3xl p-6 shadow-lg">
            <div className="text-5xl" aria-hidden>{a.emoji}</div>
            <p className="mt-2 text-xs font-bold tracking-[0.25em] uppercase opacity-60">Award {i + 1}</p>
            <h3 className="font-display text-2xl mt-1 text-balance p-accent">{a.award}</h3>
            {a.reason && <p className="mt-2 opacity-85 text-balance">{a.reason}</p>}
          </motion.li>
        ))}
      </ul>
      {count < props.awards.length && (
        <button
          onClick={() => { setShown(count + 1); if (count + 1 === props.awards.length) ctx.celebrate() }}
          className="mt-4 p-btn rounded-full px-7 py-3 font-semibold shadow-lg"
        >
          🏆 {count ? 'Next award' : 'Reveal the first award'} ({count + 1}/{props.awards.length})
        </button>
      )}
    </div>
  )
}

// ---------- journey ----------
export function Journey({ props, ctx }: P<'journey'>) {
  return (
    <div>
      {props.title && <h2 className="font-display text-3xl text-center text-balance">{props.title}</h2>}
      <ol className="mt-6" aria-label={props.title || 'Journey'}>
        {props.stops.map((s, i) => {
          const last = i === props.stops.length - 1
          const photo = ctx.photo(s.photoId)
          return (
            <motion.li key={i} initial={{ opacity: 0, x: 24 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} className="flex gap-4">
              <div className="flex flex-col items-center w-12 shrink-0" aria-hidden>
                <div className="size-12 rounded-full p-btn grid place-items-center text-2xl shadow-lg ring-4 ring-white/70">{s.emoji}</div>
                {!last && (
                  <svg className="flex-1 w-6 min-h-10" viewBox="0 0 24 100" preserveAspectRatio="none">
                    <path d={i % 2 ? 'M12 0 C -4 30, 28 70, 12 100' : 'M12 0 C 28 30, -4 70, 12 100'} fill="none" stroke="var(--p-accent)" strokeWidth="3" strokeLinecap="round" strokeDasharray="1 8" vectorEffect="non-scaling-stroke" />
                  </svg>
                )}
              </div>
              <div className={`flex-1 p-card rounded-2xl shadow-lg overflow-hidden ${last ? '' : 'mb-4'}`}>
                {photo && <Img src={photo} alt={s.place} className="w-full aspect-[16/9] object-cover" />}
                <div className="p-4">
                  <p className="text-xs font-bold tracking-[0.2em] uppercase opacity-60">Stop {i + 1}{s.dateLabel && ` · ${s.dateLabel}`}</p>
                  <h3 className="font-display text-xl mt-1">{s.place}</h3>
                  {s.note && <p className="mt-1 opacity-85 whitespace-pre-line">{s.note}</p>}
                </div>
              </div>
            </motion.li>
          )
        })}
      </ol>
    </div>
  )
}

// ---------- magazine cover ----------
export function MagazineCover({ props, ctx }: P<'magazine_cover'>) {
  const photo = ctx.photo(props.photoId)
  const lines = props.coverLines.filter(Boolean)
  return (
    <figure className="relative aspect-[3/4] rounded-xl overflow-hidden shadow-2xl text-white" style={{ background: 'linear-gradient(160deg, var(--p-accent), var(--p-ink))' }}>
      {photo && <Img src={photo} alt={props.headline} className="absolute inset-0 size-full object-cover" />}
      <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-transparent to-black/70" aria-hidden />
      <div className="relative h-full flex flex-col p-5 sm:p-7 [text-shadow:0_2px_12px_rgba(0,0,0,0.45)]">
        <div className="flex items-start justify-between gap-2">
          <p className="font-display uppercase leading-none tracking-tight text-[clamp(3rem,16vw,6rem)] break-words">{props.masthead}</p>
          {props.issue && <p className="text-[0.65rem] font-bold tracking-[0.2em] uppercase text-right mt-2 max-w-[7rem]">{props.issue}</p>}
        </div>
        {lines.length > 0 && (
          <ul className="mt-4 space-y-2 max-w-[60%]">
            {lines.map((l, i) => <li key={i} className={`font-bold leading-tight ${i === 0 ? 'text-lg' : 'text-sm'} border-l-4 border-[var(--p-accent)] pl-2`}>{l}</li>)}
          </ul>
        )}
        <figcaption className="mt-auto font-display text-3xl sm:text-4xl leading-[1.05] text-balance">{props.headline}</figcaption>
        <div className="absolute bottom-4 right-4 h-8 w-16 bg-white rounded-sm p-1" aria-hidden style={{ backgroundImage: 'repeating-linear-gradient(90deg, #111 0 2px, transparent 2px 3px, #111 3px 4px, transparent 4px 6px)', backgroundClip: 'content-box' }} />
      </div>
    </figure>
  )
}

// ---------- audio with waveform ----------
const BARS = 60
const mmss = (t: number) => (Number.isFinite(t) ? `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}` : '0:00')

function Waveform({ src, title }: { src: string; title: string }) {
  const audio = useRef<HTMLAudioElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const [peaks, setPeaks] = useState<number[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState({ at: 0, total: 0 })

  useEffect(() => {
    const abort = new AbortController()
    fetch(src, { signal: abort.signal })
      .then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.arrayBuffer() })
      .then((buf) => new OfflineAudioContext(1, 1, 44100).decodeAudioData(buf)) // offline: no autoplay prompt, nothing to close
      .then((decoded) => {
        const data = decoded.getChannelData(0)
        const size = Math.max(1, Math.floor(data.length / BARS))
        const raw = Array.from({ length: BARS }, (_, b) => {
          let max = 0
          for (let i = b * size; i < Math.min(data.length, (b + 1) * size); i += 16) max = Math.max(max, Math.abs(data[i]))
          return max
        })
        const top = Math.max(...raw) || 1
        setPeaks(raw.map((v) => Math.max(0.06, v / top)))
      })
      .catch(() => { if (!abort.signal.aborted) setFailed(true) }) // CORS, unsupported codec…: native controls instead
    return () => abort.abort()
  }, [src])

  const progress = time.total ? time.at / time.total : 0
  useEffect(() => {
    const c = canvas.current
    if (!c || failed) return
    const dpr = window.devicePixelRatio || 1
    const w = (c.width = c.offsetWidth * dpr), h = (c.height = c.offsetHeight * dpr)
    const g = c.getContext('2d')!
    const css = getComputedStyle(c)
    const played = css.getPropertyValue('--p-accent').trim() || '#e9573f'
    g.clearRect(0, 0, w, h)
    const step = w / BARS
    for (let i = 0; i < BARS; i++) {
      const v = peaks ? peaks[i] : 0.12
      const bh = Math.max(2 * dpr, v * h)
      g.fillStyle = (i + 0.5) / BARS <= progress ? played : css.color
      g.globalAlpha = (i + 0.5) / BARS <= progress ? 1 : 0.3
      g.beginPath()
      g.roundRect(i * step + step * 0.2, (h - bh) / 2, step * 0.6, bh, step * 0.3)
      g.fill()
    }
  }, [peaks, progress, failed])

  const seekTo = (fraction: number) => {
    const a = audio.current
    if (a && Number.isFinite(a.duration)) a.currentTime = Math.min(1, Math.max(0, fraction)) * a.duration
  }
  const sync = () => { const a = audio.current; if (a) setTime({ at: a.currentTime, total: a.duration || 0 }) }

  return (
    <div>
      {!failed && (
        <div className="flex items-center gap-3">
          <button
            onClick={() => (audio.current?.paused ? audio.current.play().catch(() => {}) : audio.current?.pause())}
            aria-label={playing ? `Pause ${title || 'audio'}` : `Play ${title || 'audio'}`}
            className="p-btn size-12 shrink-0 rounded-full grid place-items-center text-xl shadow-lg"
          >
            <span aria-hidden>{playing ? '❚❚' : '▶'}</span>
          </button>
          <div className="flex-1 min-w-0">
            <div
              role="slider"
              tabIndex={0}
              aria-label="Seek"
              aria-valuemin={0}
              aria-valuemax={Math.round(time.total)}
              aria-valuenow={Math.round(time.at)}
              aria-valuetext={`${mmss(time.at)} of ${mmss(time.total)}`}
              onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); seekTo((e.clientX - r.left) / r.width) }}
              onKeyDown={(e) => {
                const d = e.key === 'ArrowRight' ? 5 : e.key === 'ArrowLeft' ? -5 : 0
                if (d && time.total) { e.preventDefault(); seekTo((time.at + d) / time.total) }
              }}
              className="cursor-pointer rounded-lg focus-visible:outline-2 focus-visible:outline-[var(--p-accent)]"
            >
              <canvas ref={canvas} className="block w-full h-14" aria-hidden />
            </div>
            <div className="flex justify-between text-xs tabular-nums opacity-60 mt-1"><span>{mmss(time.at)}</span><span>{mmss(time.total)}</span></div>
          </div>
        </div>
      )}
      <audio
        ref={audio}
        src={src}
        preload="metadata"
        controls={failed}
        className={failed ? 'w-full' : 'hidden'}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onTimeUpdate={sync}
        onLoadedMetadata={sync}
        onDurationChange={sync}
      />
    </div>
  )
}

export function Audio({ props, ctx }: P<'audio'>) {
  const src = ctx.photo(props.audioId)
  return (
    <figure className="p-card rounded-3xl p-6 shadow-lg text-center space-y-3">
      <div className="text-4xl" aria-hidden>🎵</div>
      {props.title && <figcaption className="font-display text-2xl">{props.title}</figcaption>}
      {src ? <Waveform key={src} src={src} title={props.title} /> : <p className="text-sm opacity-60">Audio coming soon</p>}
      {props.note && <p className="font-hand text-xl opacity-85">{props.note}</p>}
    </figure>
  )
}
