import { z } from 'zod'

// ---------- Studio input (what the creator types) ----------

export const OCCASIONS = ['birthday', 'anniversary', 'friendship', 'appreciation', 'just_because', 'custom'] as const
export const TONES = ['funny', 'emotional', 'romantic', 'cute', 'nostalgic', 'playful', 'deep', 'mixed'] as const
export const EXPERIENCES = ['treasure_hunt', 'memory_journey', 'quiz', 'gift_reveal', 'cards', 'open_when'] as const
export const PALETTES = ['sunrise', 'lagoon', 'midnight', 'blossom', 'meadow', 'candy'] as const
export const MOTION = ['full', 'gentle', 'off'] as const

export type Occasion = (typeof OCCASIONS)[number]
export type ExperienceType = (typeof EXPERIENCES)[number]
export type Palette = (typeof PALETTES)[number]

const text = (max: number) => z.string().trim().max(max)
const list = (maxItems: number, maxLen = 400) => z.array(text(maxLen)).max(maxItems).default([])

export const StudioInput = z.object({
  occasion: z.enum(OCCASIONS),
  customOccasion: text(80).default(''),
  recipientName: text(60).min(1, 'Who is this for?'),
  creatorName: text(60).min(1, 'Add your name so they know who made it'),
  relationship: text(80).default(''),
  personality: text(400).default(''),
  interests: text(400).default(''),
  loves: text(400).default(''),
  language: text(40).default('English'),
  tone: z.enum(TONES).default('mixed'),
  memories: list(10, 600),
  insideJokes: list(8),
  importantDates: list(6, 120),
  specialPhrases: list(6, 200),
  appreciation: text(800).default(''),
  personalMessage: text(1200).default(''),
  difficulty: z.enum(['easy', 'medium', 'hard']).default('medium'),
  experienceType: z.enum(EXPERIENCES).optional(),
})
export type StudioInput = z.infer<typeof StudioInput>

// ---------- Experience content (what the AI writes) ----------
// Every field is required and bounded so the same schema is also the strict JSON schema sent to the model.
// Optional, creator-only fields (photoId, unlockAt) are added by `withCreatorFields` below, never by the AI.

const s = (max: number) => z.string().max(max)
const Closing = z.object({ title: s(120), message: s(2000) })

const Base = {
  title: s(120),
  subtitle: s(200),
  intro: s(800),
  palette: z.enum(PALETTES),
  closing: Closing,
}

export const TreasureHuntAI = z.object({
  ...Base,
  clues: z
    .array(
      z.object({
        riddle: s(500),
        answer: s(60),
        acceptedAnswers: z.array(s(60)).max(6),
        hint: s(300),
        successMessage: s(300),
      }),
    )
    .min(3)
    .max(6),
})

export const MemoryJourneyAI = z.object({
  ...Base,
  moments: z
    .array(z.object({ heading: s(120), dateLabel: s(60), story: s(900), emoji: s(8) }))
    .min(2)
    .max(10),
})

export const QuizAI = z.object({
  ...Base,
  questions: z
    .array(
      z.object({
        question: s(300),
        options: z.array(s(140)).length(4),
        correctIndex: z.number().int().min(0).max(3),
        reveal: s(400),
      }),
    )
    .min(4)
    .max(8),
  results: z.object({ high: s(400), medium: s(400), low: s(400) }),
})

export const GiftRevealAI = z.object({
  ...Base,
  anticipation: z.array(s(160)).min(2).max(4),
  stages: z
    .array(z.object({ label: s(80), message: s(500) }))
    .min(2)
    .max(4),
  gift: z.object({ title: s(120), message: s(1500) }),
})

export const CardsAI = z.object({
  ...Base,
  deckTitle: s(120),
  cards: z
    .array(z.object({ emoji: s(8), heading: s(120), body: s(500) }))
    .min(5)
    .max(10),
})

export const OpenWhenAI = z.object({
  ...Base,
  letters: z
    .array(z.object({ when: s(100), emoji: s(8), letter: s(2500) }))
    .min(4)
    .max(8),
})

export const AI_SCHEMAS = {
  treasure_hunt: TreasureHuntAI,
  memory_journey: MemoryJourneyAI,
  quiz: QuizAI,
  gift_reveal: GiftRevealAI,
  cards: CardsAI,
  open_when: OpenWhenAI,
} as const

// Which array in each experience holds the regenerable items, and its item schema.
export const SECTION_LISTS: Record<ExperienceType, string> = {
  treasure_hunt: 'clues',
  memory_journey: 'moments',
  quiz: 'questions',
  gift_reveal: 'stages',
  cards: 'cards',
  open_when: 'letters',
}

export function itemSchema(type: ExperienceType) {
  const shape = AI_SCHEMAS[type].shape as Record<string, z.ZodType>
  return (shape[SECTION_LISTS[type]] as z.ZodArray<z.ZodObject>).element
}

// Stored content = AI content + creator-only extras. Kept loose on extras, strict on the AI part.
const extras = z.object({
  photoId: z.string().max(40).optional(),
  unlockAt: z.string().datetime().optional(),
})
export const StoredContent = z.discriminatedUnion('type', [
  TreasureHuntAI.extend({ type: z.literal('treasure_hunt') }),
  MemoryJourneyAI.extend({
    type: z.literal('memory_journey'),
    moments: z.array(MemoryJourneyAI.shape.moments.element.extend(extras.shape)).min(1).max(10),
  }),
  QuizAI.extend({ type: z.literal('quiz') }),
  GiftRevealAI.extend({ type: z.literal('gift_reveal'), giftPhotoId: z.string().max(40).optional() }),
  CardsAI.extend({ type: z.literal('cards') }),
  OpenWhenAI.extend({
    type: z.literal('open_when'),
    letters: z.array(OpenWhenAI.shape.letters.element.extend(extras.shape)).min(1).max(8),
  }),
])
export type StoredContent = z.infer<typeof StoredContent>

export const Theme = z.object({
  palette: z.enum(PALETTES),
  motion: z.enum(MOTION).default('full'),
})
export type Theme = z.infer<typeof Theme>
