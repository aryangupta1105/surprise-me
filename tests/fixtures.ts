import { db } from '@/lib/db'

export const studioInput = {
  occasion: 'birthday', customOccasion: '', recipientName: 'Maya', creatorName: 'Rohan', relationship: 'best friend', personality: '', interests: 'ramen',
  loves: '', language: 'English', tone: 'funny', memories: ['Lost in Goa'], insideJokes: [], importantDates: [], specialPhrases: [], appreciation: '',
  personalMessage: '', difficulty: 'medium', experienceType: 'cards',
} as const

export const cardsOutput = {
  title: 'For Maya', subtitle: 'from Rohan', intro: 'Hi', palette: 'candy', closing: { title: 'Bye', message: 'Love' }, deckTitle: 'Deck',
  cards: Array.from({ length: 5 }, (_, i) => ({ emoji: '⭐', heading: `Card ${i}`, body: 'Body' })),
}

export async function makeUser(isGuest = true) {
  return db.user.create({ data: { isGuest } })
}

export async function makeSurprise(ownerId: string, withContent = false) {
  return db.surprise.create({
    data: {
      ownerId, occasion: 'birthday', recipientName: 'Maya', creatorName: 'Rohan', experienceType: 'cards', input: studioInput,
      ...(withContent ? { content: { ...cardsOutput, type: 'cards' }, generationStatus: 'SUCCEEDED' as const } : {}),
    },
  })
}
