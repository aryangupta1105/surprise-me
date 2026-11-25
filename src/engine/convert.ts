import type { StoredContent, Theme } from '@/lib/schemas'
import type { BlockType } from './blocks'
import { parseDoc, type Scene, type SurpriseDoc } from './doc'

// Turns a legacy single-experience surprise into a scene document: opening → the experience → finale.
// Ids are derived from the type so the same content always converts to the same document.

const BLOCK_FOR: Record<StoredContent['type'], BlockType> = {
  treasure_hunt: 'treasure_hunt', memory_journey: 'timeline', quiz: 'quiz', gift_reveal: 'gift_reveal', cards: 'cards', open_when: 'open_when',
}

function experienceProps(c: StoredContent): Record<string, unknown> {
  switch (c.type) {
    case 'treasure_hunt': return { clues: c.clues }
    case 'memory_journey': return { moments: c.moments }
    case 'quiz': return { questions: c.questions, results: c.results }
    case 'gift_reveal': return { anticipation: c.anticipation, stages: c.stages, gift: c.gift, giftPhotoId: c.giftPhotoId }
    case 'cards': return { deckTitle: c.deckTitle, cards: c.cards }
    case 'open_when': return { letters: c.letters }
  }
}

/** The interactive block for one generated experience (id assigned by the caller). */
export const experienceBlock = (c: StoredContent) => ({ id: 'main-experience', type: BLOCK_FOR[c.type], props: experienceProps(c) })

export function legacyToDoc(c: StoredContent, theme?: Partial<Theme>): SurpriseDoc {
  const scenes: Scene[] = [
    {
      id: 'opening', kind: 'opening', title: 'Opening', transition: 'fade',
      blocks: [
        { id: 'opening-heading', type: 'heading', props: { text: c.title, size: 'xl', kicker: 'A surprise for you' } },
        { id: 'opening-subtitle', type: 'paragraph', props: { text: c.subtitle } },
        { id: 'opening-intro', type: 'handwritten', props: { text: c.intro } },
      ],
    },
    {
      id: 'main', kind: 'game', title: 'The surprise', transition: 'slide',
      blocks: [experienceBlock(c)],
    },
    {
      id: 'finale', kind: 'finale', title: 'Finale', transition: 'zoom',
      blocks: [
        { id: 'finale-confetti', type: 'confetti', props: { intensity: 'full' } },
        { id: 'finale-heading', type: 'heading', props: { text: c.closing.title, size: 'lg', kicker: '' } },
        { id: 'finale-letter', type: 'letter', props: { greeting: '', body: c.closing.message, signoff: '' } },
      ],
    },
  ]
  return parseDoc({ version: 1, theme: { palette: theme?.palette ?? c.palette, motion: theme?.motion ?? 'full' }, scenes })
}
