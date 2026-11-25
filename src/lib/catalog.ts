import type { ExperienceType, Occasion, Palette } from './schemas'

export const OCCASION_INFO: Record<Occasion, { label: string; emoji: string; blurb: string; tint: string }> = {
  birthday: { label: 'Birthday', emoji: '🎂', blurb: 'Another trip around the sun', tint: 'from-[#ffe1c7] to-[#ffc2b0]' },
  anniversary: { label: 'Anniversary', emoji: '💞', blurb: 'Celebrate your story', tint: 'from-[#ffd7e3] to-[#f6b1c7]' },
  friendship: { label: 'Friendship', emoji: '🫶', blurb: 'For your favourite human', tint: 'from-[#dff3d0] to-[#bfe3a6]' },
  appreciation: { label: 'Appreciation', emoji: '🌟', blurb: 'Say thank you, properly', tint: 'from-[#fff1b8] to-[#ffd97a]' },
  just_because: { label: 'Just Because', emoji: '🎈', blurb: 'No reason needed', tint: 'from-[#d9ecff] to-[#b4d6f5]' },
  custom: { label: 'Something else', emoji: '✨', blurb: 'Name your own moment', tint: 'from-[#ece0ff] to-[#d2c0f5]' },
}

export const EXPERIENCE_INFO: Record<ExperienceType, { label: string; emoji: string; blurb: string; best: string }> = {
  treasure_hunt: { label: 'Mystery Treasure Hunt', emoji: '🗝️', blurb: 'Riddles built from your memories unlock a final message.', best: 'Playful friends, inside jokes' },
  memory_journey: { label: 'Memory Journey', emoji: '🛤️', blurb: 'A beautiful timeline of your moments together, with photos.', best: 'Anniversaries, long friendships' },
  quiz: { label: 'How Well Do You Know Me?', emoji: '🧠', blurb: 'A personal quiz with funny reveals and a final score.', best: 'Best friends, siblings' },
  gift_reveal: { label: 'Mystery Gift Reveal', emoji: '🎁', blurb: 'Build-up, a box to open, and a dramatic reveal.', best: 'Birthdays, a real gift to announce' },
  cards: { label: 'Personality Cards', emoji: '🃏', blurb: 'Swipeable cards: things you love, their chaotic traits…', best: 'Quick, funny, heartfelt' },
  open_when: { label: 'Open When… Letters', emoji: '💌', blurb: 'Letters for the moments they’ll need you most.', best: 'Partners, long distance' },
}

export const TONE_LABELS = { funny: 'Funny', emotional: 'Emotional', romantic: 'Romantic', cute: 'Cute', nostalgic: 'Nostalgic', playful: 'Playful', deep: 'Deep & meaningful', mixed: 'A bit of everything' } as const

export const PALETTE_INFO: Record<Palette, { label: string; swatch: string }> = {
  sunrise: { label: 'Sunrise', swatch: 'linear-gradient(135deg,#fff3e3,#ffb8a8)' },
  lagoon: { label: 'Lagoon', swatch: 'linear-gradient(135deg,#e9fbf7,#8fd3d8)' },
  midnight: { label: 'Midnight', swatch: 'linear-gradient(135deg,#3b2b6b,#0e0b22)' },
  blossom: { label: 'Blossom', swatch: 'linear-gradient(135deg,#fff0f4,#f7b3c8)' },
  meadow: { label: 'Meadow', swatch: 'linear-gradient(135deg,#f7fbe8,#bfe0a3)' },
  candy: { label: 'Candy', swatch: 'linear-gradient(135deg,#fde7ff,#d9f1ff)' },
}

// The only time zones Google Calendar's Create_Calendar_Event (v24) accepts, from its docs page.
export const CALENDAR_TIMEZONES = [
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'Europe/London', 'Europe/Paris',
  'Europe/Berlin', 'Asia/Tokyo', 'Asia/Shanghai', 'Asia/Kolkata', 'Australia/Sydney', 'Asia/Dubai', 'Europe/Moscow',
  'America/Toronto', 'America/Mexico_City', 'America/Sao_Paulo', 'Africa/Johannesburg', 'Asia/Singapore', 'Europe/Madrid',
  'Asia/Hong_Kong',
] as const

