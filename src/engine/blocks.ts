import { z } from 'zod'
import { CardsAI, GiftRevealAI, MemoryJourneyAI, OpenWhenAI, QuizAI, TreasureHuntAI } from '@/lib/schemas'

// The block registry: every block type the engine knows, with the Zod schema of its props.
// Server-safe (no React). Renderers live in src/engine/player/renderers.tsx, keyed by the same type.
// Adding a block type = one entry here + one renderer; the engine itself does not change.

const id = z.string().max(40)
const media = id.optional() // MediaAsset / Upload id; resolved to a URL by the player
const text = (max: number) => z.string().max(max)

const extras = { photoId: media, unlockAt: z.string().datetime().optional() }

export const BLOCKS = {
  // ---- text ----
  heading: {
    label: 'Heading', category: 'text', emoji: '🔤',
    schema: z.object({ text: text(160), size: z.enum(['xl', 'lg', 'md']).default('xl'), kicker: text(80).default('') }),
    create: () => ({ text: 'A heading', size: 'xl', kicker: '' }),
  },
  paragraph: {
    label: 'Paragraph', category: 'text', emoji: '📝',
    schema: z.object({ text: text(2000) }),
    create: () => ({ text: 'Write something…' }),
  },
  handwritten: {
    label: 'Handwritten note', category: 'text', emoji: '✍️',
    schema: z.object({ text: text(1200) }),
    create: () => ({ text: 'A little note in my own hand…' }),
  },
  quote: {
    label: 'Quote', category: 'text', emoji: '❝',
    schema: z.object({ text: text(500), by: text(80).default('') }),
    create: () => ({ text: 'Something worth remembering', by: '' }),
  },
  letter: {
    label: 'Letter', category: 'text', emoji: '💌',
    schema: z.object({ greeting: text(120).default(''), body: text(4000), signoff: text(120).default('') }),
    create: () => ({ greeting: 'Dear you,', body: 'Write your letter here…', signoff: 'With love' }),
  },
  // ---- images ----
  image: {
    label: 'Image', category: 'image', emoji: '🖼️',
    schema: z.object({ photoId: media, caption: text(300).default(''), alt: text(200).default('') }),
    create: () => ({ caption: '', alt: '' }),
  },
  gallery: {
    label: 'Photo gallery', category: 'image', emoji: '📸',
    schema: z.object({
      layout: z.enum(['grid', 'polaroid', 'slideshow']).default('polaroid'),
      items: z.array(z.object({ photoId: media, caption: text(300).default(''), alt: text(200).default('') })).max(24),
    }),
    create: () => ({ layout: 'polaroid', items: [] }),
  },
  // ---- audio & video ----
  audio: {
    label: 'Song or voice note', category: 'media', emoji: '🎙️',
    schema: z.object({ audioId: media, title: text(120).default(''), note: text(300).default('') }),
    create: () => ({ title: 'Press play', note: '' }),
  },
  video: {
    label: 'Video', category: 'media', emoji: '🎬',
    schema: z.object({ videoId: media, caption: text(300).default('') }),
    create: () => ({ caption: '' }),
  },
  // ---- interactive (the original six experiences, now composable blocks) ----
  treasure_hunt: {
    label: 'Treasure hunt', category: 'interactive', emoji: '🗝️', interactive: true,
    schema: z.object({ clues: TreasureHuntAI.shape.clues }),
    create: () => ({ clues: [1, 2, 3].map((n) => ({ riddle: `Riddle ${n}`, answer: 'answer', acceptedAnswers: [], hint: 'A hint', successMessage: 'You got it!' })) }),
  },
  timeline: {
    label: 'Memory timeline', category: 'interactive', emoji: '🛤️', interactive: true,
    schema: z.object({ moments: z.array(MemoryJourneyAI.shape.moments.element.extend({ photoId: media })).min(1).max(10) }),
    create: () => ({ moments: [{ heading: 'A memory', dateLabel: '', story: 'Tell the story…', emoji: '✨' }] }),
  },
  quiz: {
    label: 'Quiz', category: 'interactive', emoji: '🧠', interactive: true,
    schema: z.object({ questions: QuizAI.shape.questions, results: QuizAI.shape.results }),
    create: () => ({
      questions: [1, 2, 3, 4].map((n) => ({ question: `Question ${n}?`, options: ['A', 'B', 'C', 'D'], correctIndex: 0, reveal: '' })),
      results: { high: 'You know me so well!', medium: 'Not bad!', low: 'We need more time together.' },
    }),
  },
  gift_reveal: {
    label: 'Gift reveal', category: 'interactive', emoji: '🎁', interactive: true,
    schema: z.object({ anticipation: GiftRevealAI.shape.anticipation, stages: GiftRevealAI.shape.stages, gift: GiftRevealAI.shape.gift, giftPhotoId: media }),
    create: () => ({ anticipation: ['Something is coming…', 'Almost…'], stages: [{ label: 'First', message: '…' }, { label: 'Then', message: '…' }], gift: { title: 'Surprise!', message: '…' } }),
  },
  cards: {
    label: 'Card deck', category: 'interactive', emoji: '🃏', interactive: true,
    schema: z.object({ deckTitle: CardsAI.shape.deckTitle, cards: CardsAI.shape.cards }),
    create: () => ({ deckTitle: 'Things I love about you', cards: [1, 2, 3, 4, 5].map((n) => ({ emoji: '⭐', heading: `Card ${n}`, body: '…' })) }),
  },
  open_when: {
    label: 'Open-when letters', category: 'interactive', emoji: '✉️', interactive: true,
    schema: z.object({ letters: z.array(OpenWhenAI.shape.letters.element.extend(extras)).min(1).max(8) }),
    create: () => ({ letters: [{ when: 'Open when you miss me', emoji: '💌', letter: '…' }] }),
  },
  // ---- decorative ----
  confetti: {
    label: 'Confetti burst', category: 'decor', emoji: '🎉',
    schema: z.object({ intensity: z.enum(['gentle', 'full']).default('full') }),
    create: () => ({ intensity: 'full' }),
  },
} as const

export type BlockType = keyof typeof BLOCKS
export const BLOCK_TYPES = Object.keys(BLOCKS) as BlockType[]
export type BlockProps<T extends BlockType> = z.infer<(typeof BLOCKS)[T]['schema']>
export const isInteractive = (type: string) => Boolean((BLOCKS as Record<string, { interactive?: boolean }>)[type]?.interactive)
