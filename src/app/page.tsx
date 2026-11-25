import Link from 'next/link'
import { Button } from '@/components/ui'
import { HeroPreview } from '@/components/site/HeroPreview'
import { Logo, Nav } from '@/components/site/Nav'
import { EXPERIENCE_INFO, OCCASION_INFO } from '@/lib/catalog'
import { EXPERIENCES, OCCASIONS } from '@/lib/schemas'

const STEPS = [
  { n: '01', title: 'Tell us about them', body: 'Their name, your memories, the inside jokes only you two get. Skip anything you like.' },
  { n: '02', title: 'Pick an experience', body: 'A treasure hunt, a quiz, letters for later… We write it from your words, never generic filler.' },
  { n: '03', title: 'Tweak, then share', body: 'Edit every line, swap colours, then send a private link or schedule an email for the big day.' },
]

const EXAMPLES = [
  { who: 'For a best friend', type: 'Treasure Hunt', line: '“Clue 3: the place where you swore you’d never eat instant noodles again. You lasted four hours.”', tint: 'bg-[#ffe7d6]' },
  { who: 'For a partner', type: 'Open When… Letters', line: '“Open when you miss me: put on the hoodie I ‘accidentally’ left at yours. It’s working as intended.”', tint: 'bg-[#ffe1ea]' },
  { who: 'For a mentor', type: 'Personality Cards', line: '“Card 4 — The Calm One: you answered my 2 a.m. panic with ‘okay, first, drink water.’ It worked.”', tint: 'bg-[#e6f4d9]' },
]

export default function Home() {
  return (
    <div className="grain relative">
      <Nav />
      <main className="relative z-10">
        {/* Hero */}
        <section className="mx-auto max-w-6xl px-5 pt-6 pb-20 grid lg:grid-cols-[1.15fr_1fr] gap-14 items-center">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-white/80 ring-1 ring-line px-3 py-1.5 text-sm font-semibold">
              <span className="size-2 rounded-full bg-rose animate-pulse" /> No account needed to create or open
            </p>
            <h1 className="font-display text-[3.2rem] sm:text-7xl leading-[0.95] tracking-tight mt-6 text-balance">
              Make someone’s day <em className="text-rose not-italic relative">unforgettable<svg className="absolute -bottom-2 left-0 w-full" viewBox="0 0 300 12" fill="none" aria-hidden><path d="M2 9c60-6 140-8 296-2" stroke="currentColor" strokeWidth="4" strokeLinecap="round" /></svg></em>.
            </h1>
            <p className="mt-7 text-lg sm:text-xl text-ink-soft max-w-xl leading-relaxed">
              Turn your memories and inside jokes into an interactive surprise — a treasure hunt, a quiz, a gift to unwrap — that they open with one private link.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Button href="/create" size="lg">Create a Surprise →</Button>
              <Button href="#experiences" size="lg" variant="secondary">See the experiences</Button>
            </div>
            <p className="mt-5 font-hand text-2xl text-ink-soft">takes about 4 minutes ✿</p>
          </div>
          <HeroPreview />
        </section>

        {/* Occasions strip */}
        <section className="border-y border-line bg-white/60">
          <div className="mx-auto max-w-6xl px-5 py-6 flex flex-wrap justify-center gap-x-8 gap-y-3 text-ink-soft font-semibold">
            {OCCASIONS.map((o) => (
              <span key={o} className="flex items-center gap-2"><span aria-hidden>{OCCASION_INFO[o].emoji}</span>{OCCASION_INFO[o].label}</span>
            ))}
          </div>
        </section>

        {/* Experiences */}
        <section id="experiences" className="mx-auto max-w-6xl px-5 py-24">
          <h2 className="font-display text-4xl sm:text-5xl max-w-2xl text-balance">Six ways to say “I thought about you”.</h2>
          <p className="text-ink-soft text-lg mt-4 max-w-xl">Each one is its own little world, made to be opened on a phone.</p>
          <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {EXPERIENCES.map((e, i) => (
              <div key={e} className="group relative rounded-[var(--radius-card)] bg-white ring-1 ring-line p-7 shadow-[var(--shadow-soft)] hover:shadow-[var(--shadow-lift)] hover:-translate-y-1 transition-all" style={{ ['--r' as string]: `${(i % 3) - 1}deg` }}>
                <div className="text-4xl wiggle inline-block" aria-hidden>{EXPERIENCE_INFO[e].emoji}</div>
                <h3 className="font-display text-2xl mt-4">{EXPERIENCE_INFO[e].label}</h3>
                <p className="text-ink-soft mt-2">{EXPERIENCE_INFO[e].blurb}</p>
                <p className="text-xs font-bold uppercase tracking-widest text-rose mt-5">Best for · {EXPERIENCE_INFO[e].best}</p>
              </div>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section className="bg-ink text-paper">
          <div className="mx-auto max-w-6xl px-5 py-24">
            <h2 className="font-display text-4xl sm:text-5xl">How it works</h2>
            <ol className="mt-12 grid md:grid-cols-3 gap-10">
              {STEPS.map((s) => (
                <li key={s.n}>
                  <p className="font-display text-6xl text-peach">{s.n}</p>
                  <h3 className="font-display text-2xl mt-3">{s.title}</h3>
                  <p className="mt-3 text-paper/75 leading-relaxed">{s.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Examples */}
        <section className="mx-auto max-w-6xl px-5 py-24">
          <h2 className="font-display text-4xl sm:text-5xl max-w-2xl">Personal, not greeting-card.</h2>
          <p className="text-ink-soft text-lg mt-4">Illustrative examples of the kind of lines SurpriseMe writes from your details.</p>
          <div className="mt-12 grid md:grid-cols-3 gap-5">
            {EXAMPLES.map((x, i) => (
              <figure key={i} className={`rounded-[var(--radius-card)] ${x.tint} p-7 ${i === 1 ? 'md:translate-y-8' : ''}`}>
                <blockquote className="font-hand text-2xl leading-snug">{x.line}</blockquote>
                <figcaption className="mt-6 text-sm font-semibold text-ink-soft">{x.who} · {x.type}</figcaption>
              </figure>
            ))}
          </div>
        </section>

        {/* Benefits */}
        <section className="mx-auto max-w-6xl px-5 pb-24 grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {[
            ['🔒', 'Private by default', 'Unguessable links you can switch off any time. Never indexed by search engines.'],
            ['📱', 'Made for phones', 'Every experience is designed for a thumb first.'],
            ['✍️', 'Your words, edited by you', 'Change any line, regenerate a single clue, pick the colours.'],
            ['⏰', 'Right on time', 'Schedule the email for midnight on their birthday and set a calendar reminder.'],
          ].map(([e, t, b]) => (
            <div key={t}>
              <div className="text-3xl" aria-hidden>{e}</div>
              <h3 className="font-semibold text-lg mt-3">{t}</h3>
              <p className="text-ink-soft mt-1.5 text-[15px] leading-relaxed">{b}</p>
            </div>
          ))}
        </section>

        {/* Final CTA */}
        <section className="mx-auto max-w-6xl px-5 pb-24">
          <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-rose to-[#ff8a6a] text-white p-10 sm:p-16 text-center">
            <div className="absolute -top-10 -left-10 text-[10rem] opacity-15 rotate-12" aria-hidden>🎁</div>
            <h2 className="font-display text-4xl sm:text-6xl text-balance relative">Someone deserves a little magic today.</h2>
            <Link href="/create" className="relative inline-flex mt-9 h-14 items-center px-9 rounded-full bg-white text-rose-deep font-bold text-lg shadow-lg hover:scale-105 transition">
              Create a Surprise →
            </Link>
          </div>
        </section>
      </main>
      <footer className="relative z-10 border-t border-line">
        <div className="mx-auto max-w-6xl px-5 py-8 flex flex-wrap items-center justify-between gap-4 text-sm text-ink-soft">
          <Logo />
          <p>Made with care. Your memories stay yours.</p>
        </div>
      </footer>
    </div>
  )
}
