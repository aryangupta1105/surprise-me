import type { BlockType } from '@/engine/blocks'
import type { Scene } from '@/engine/doc'
import type { Occasion, Palette } from '@/lib/schemas'

// Starter templates: plain data, validated through the engine like any document (tests/templates.test.ts).
// {to} and {from} are replaced with the names; empty photoId/audioId/videoId fields are the media to add.

export type TemplateScene = Omit<Scene, 'id' | 'blocks'> & { blocks: { type: BlockType; props: Record<string, unknown> }[] }
export type Template = {
  id: string
  name: string
  emoji: string
  description: string
  category: 'Celebrate' | 'Love' | 'Friendship' | 'Memories' | 'Games' | 'Letters' | 'Music'
  occasions: Occasion[]
  palette: Palette
  motion: 'full' | 'gentle'
  customize: string[] // what the creator should make their own
  scenes: TemplateScene[]
}

const b = (type: BlockType, props: Record<string, unknown> = {}) => ({ type, props })
const opening = (kicker: string, title: string, intro: string): TemplateScene => ({
  kind: 'opening', title: 'Opening', transition: 'fade',
  blocks: [b('heading', { text: title, size: 'xl', kicker }), b('handwritten', { text: intro })],
})
const finale = (title: string, body: string, signoff = '— {from}'): TemplateScene => ({
  kind: 'finale', title: 'Finale', transition: 'zoom',
  blocks: [b('confetti', { intensity: 'full' }), b('heading', { text: title, size: 'lg', kicker: '' }), b('letter', { greeting: 'Dear {to},', body, signoff })],
})
const photos = (n: number, layout: 'grid' | 'polaroid' | 'slideshow', captions: string[] = []) =>
  b('gallery', { layout, items: Array.from({ length: n }, (_, i) => ({ caption: captions[i] ?? '', alt: '' })) })

export const TEMPLATES: Template[] = [
  {
    id: 'birthday-celebration', name: 'Birthday Celebration', emoji: '🎂', category: 'Celebrate',
    description: 'A party in a link: a big hello, favourite photos, wishes from you and a confetti finale.',
    occasions: ['birthday'], palette: 'sunrise', motion: 'full',
    customize: ['Your birthday message', 'Up to 6 photos', 'The wishes deck'],
    scenes: [
      opening('Happy birthday', 'Happy birthday, {to}! 🎉', 'Today is all about you. Tap through — I made this just for you.'),
      { kind: 'media', title: 'Your year in photos', transition: 'slide', blocks: [b('heading', { text: 'A few favourite moments', size: 'md', kicker: '' }), photos(6, 'polaroid')] },
      { kind: 'game', title: 'Birthday wishes', transition: 'flip', blocks: [b('cards', { deckTitle: 'Wishes for your new year', cards: [
        { emoji: '🌟', heading: 'More adventures', body: 'May this year bring you somewhere new and wonderful.' },
        { emoji: '😂', heading: 'Endless laughs', body: 'The kind that make your stomach hurt.' },
        { emoji: '💪', heading: 'Big wins', body: 'Every goal you set — and a few you didn’t.' },
        { emoji: '☕', heading: 'Slow mornings', body: 'Time to rest, read and do absolutely nothing.' },
        { emoji: '💛', heading: 'Your people', body: 'Surrounded by those who love you (me included).' },
      ] })] },
      finale('Here’s to you', 'Another year of you is the best gift for the rest of us. Have the happiest birthday.'),
    ],
  },
  {
    id: 'romantic-love-story', name: 'Romantic Love Story', emoji: '💞', category: 'Love',
    description: 'Your story from the first hello to today, told as a timeline with photos and a love letter.',
    occasions: ['anniversary', 'just_because'], palette: 'blossom', motion: 'gentle',
    customize: ['The moments of your story', 'A photo for each moment', 'Your love letter'],
    scenes: [
      opening('Our story', '{to}, this is us', 'Every love story is beautiful, but ours is my favourite.'),
      { kind: 'game', title: 'How we happened', transition: 'slide', blocks: [b('timeline', { moments: [
        { emoji: '👋', heading: 'The first hello', dateLabel: 'The day we met', story: 'Write about the first time you saw each other.' },
        { emoji: '☕', heading: 'Our first date', dateLabel: '', story: 'Where did you go? What do you remember most?' },
        { emoji: '💫', heading: 'When I knew', dateLabel: '', story: 'The moment you realised this was something special.' },
        { emoji: '🏡', heading: 'Today', dateLabel: 'Now', story: 'What life with them looks like today.' },
      ] })] },
      { kind: 'content', title: 'A song for us', transition: 'fade', blocks: [b('audio', { title: 'Our song', note: 'Press play and think of me.' })] },
      finale('I love you', 'Thank you for every ordinary day that feels special because you are in it.', 'Forever yours, {from}'),
    ],
  },
  {
    id: 'friendship-scrapbook', name: 'Friendship Scrapbook', emoji: '📒', category: 'Friendship',
    description: 'A playful scrapbook: polaroids, inside jokes and the reasons they’re your favourite person.',
    occasions: ['friendship', 'birthday', 'just_because'], palette: 'candy', motion: 'full',
    customize: ['Photos and captions', 'Inside jokes', 'Reasons you love them'],
    scenes: [
      opening('Best friends since forever', 'The {to} & {from} scrapbook', 'Proof that we are the best duo ever. Evidence enclosed.'),
      { kind: 'media', title: 'Exhibit A: photos', transition: 'slide', blocks: [photos(4, 'polaroid', ['Us, probably laughing', 'That trip', 'Iconic', 'No comment'])] },
      { kind: 'content', title: 'Inside jokes', transition: 'flip', blocks: [b('quote', { text: 'Write the line only the two of you understand.', by: 'Us' }), b('handwritten', { text: 'Never explaining this to anyone else.' })] },
      { kind: 'game', title: 'Why you’re my person', transition: 'flip', blocks: [b('cards', { deckTitle: 'Reasons you’re my favourite', cards: [
        { emoji: '🤝', heading: 'You show up', body: 'Always, no questions asked.' },
        { emoji: '🤣', heading: 'You get my humour', body: 'Even the bad jokes. Especially the bad jokes.' },
        { emoji: '🫶', heading: 'You tell me the truth', body: 'Kindly, but you do.' },
        { emoji: '🍕', heading: 'Snack sharing', body: 'Elite level generosity.' },
        { emoji: '✨', heading: 'You make life fun', body: 'Ordinary days are better with you around.' },
      ] })] },
      finale('Friends forever', 'Thanks for being the friend everyone wishes they had. I’m lucky it’s me.'),
    ],
  },
  {
    id: 'digital-memory-book', name: 'Digital Memory Book', emoji: '📖', category: 'Memories',
    description: 'A calm, page-by-page memory book: chapters with a photo and a story each.',
    occasions: ['anniversary', 'appreciation', 'just_because'], palette: 'meadow', motion: 'gentle',
    customize: ['Chapters and stories', 'One photo per chapter', 'Closing note'],
    scenes: [
      opening('A memory book', 'Memories with {to}', 'Some days deserve to be written down. Here are a few of ours.'),
      { kind: 'content', title: 'Chapter one', transition: 'fade', blocks: [b('heading', { text: 'Chapter one', size: 'md', kicker: 'Where it began' }), b('image', { caption: '', alt: '' }), b('paragraph', { text: 'Tell the story of this memory.' })] },
      { kind: 'content', title: 'Chapter two', transition: 'fade', blocks: [b('heading', { text: 'Chapter two', size: 'md', kicker: 'The adventures' }), b('image', { caption: '', alt: '' }), b('paragraph', { text: 'Tell the story of this memory.' })] },
      { kind: 'content', title: 'Chapter three', transition: 'fade', blocks: [b('heading', { text: 'Chapter three', size: 'md', kicker: 'Right now' }), b('image', { caption: '', alt: '' }), b('paragraph', { text: 'Tell the story of this memory.' })] },
      finale('To many more chapters', 'Thank you for every page so far. I can’t wait to write the next ones with you.'),
    ],
  },
  {
    id: 'mystery-treasure-hunt', name: 'Mystery Treasure Hunt', emoji: '🗝️', category: 'Games',
    description: 'Riddles they must solve to unlock the surprise at the end.',
    occasions: ['birthday', 'anniversary', 'friendship', 'just_because'], palette: 'midnight', motion: 'full',
    customize: ['Riddles and answers about your memories', 'The final reveal'],
    scenes: [
      opening('A mystery awaits', 'Can you crack it, {to}?', 'Three clues stand between you and your surprise. Think hard!'),
      { kind: 'game', title: 'The clues', transition: 'zoom', blocks: [b('treasure_hunt', { clues: [
        { riddle: 'Where did we first meet? (Change this riddle)', answer: 'answer', acceptedAnswers: [], hint: 'Think back to the very beginning.', successMessage: 'Correct! On to the next one.' },
        { riddle: 'What is my favourite thing to eat? (Change this riddle)', answer: 'answer', acceptedAnswers: [], hint: 'I order it every single time.', successMessage: 'You know me too well.' },
        { riddle: 'What word do I say way too often? (Change this riddle)', answer: 'answer', acceptedAnswers: [], hint: 'You tease me about it.', successMessage: 'Last clue cracked!' },
      ] })] },
      finale('You did it!', 'Mystery solved. The real treasure was you all along (and also this message).'),
    ],
  },
  {
    id: 'open-when-letters', name: 'Open When Letters', emoji: '✉️', category: 'Letters',
    description: 'Sealed letters for the moments ahead — open when you’re sad, happy, missing me…',
    occasions: ['friendship', 'anniversary', 'just_because'], palette: 'blossom', motion: 'gentle',
    customize: ['Each letter', 'Optional unlock dates'],
    scenes: [
      opening('For later', 'Letters for you, {to}', 'Don’t open them all at once. Each one is for a moment.'),
      { kind: 'game', title: 'The letters', transition: 'slide', blocks: [b('open_when', { letters: [
        { emoji: '🌧️', when: 'Open when you’re having a bad day', letter: 'Write what you’d say to cheer them up.' },
        { emoji: '🎉', when: 'Open when you have good news', letter: 'Write how proud you are of them.' },
        { emoji: '🥺', when: 'Open when you miss me', letter: 'Write a memory to hold on to.' },
        { emoji: '🌙', when: 'Open when you can’t sleep', letter: 'Write something calm and kind.' },
      ] })] },
      finale('Always here', 'Whatever the moment, you’re never alone in it.'),
    ],
  },
  {
    id: 'friendship-quiz', name: 'Interactive Friendship Quiz', emoji: '🧠', category: 'Games',
    description: 'How well do they really know you? A quiz with a verdict at the end.',
    occasions: ['friendship', 'birthday', 'just_because'], palette: 'lagoon', motion: 'full',
    customize: ['Questions about you two', 'The right answers', 'Result messages'],
    scenes: [
      opening('Pop quiz', 'How well do you know me, {to}?', 'Answer honestly. I will know if you cheat.'),
      { kind: 'game', title: 'The quiz', transition: 'slide', blocks: [b('quiz', {
        questions: [
          { question: 'What’s my go-to comfort food?', options: ['Pizza', 'Noodles', 'Ice cream', 'Biryani'], correctIndex: 0, reveal: 'Change the options to match you.' },
          { question: 'Where would I go on a dream holiday?', options: ['Mountains', 'Beach', 'Big city', 'Staying home'], correctIndex: 1, reveal: '' },
          { question: 'What do I do when I’m stressed?', options: ['Sleep', 'Eat', 'Call you', 'Clean everything'], correctIndex: 2, reveal: 'Yes — always you.' },
          { question: 'What was our funniest moment?', options: ['Option A', 'Option B', 'Option C', 'Option D'], correctIndex: 3, reveal: 'Still laughing about it.' },
        ],
        results: { high: 'You know me better than I know myself!', medium: 'Pretty good — but we need more hangouts.', low: 'Who even are you? (Coffee this week, please.)' },
      })] },
      finale('Quiz complete', 'Whatever your score, you’re my favourite person to be quizzed by.'),
    ],
  },
  {
    id: 'mystery-gift-reveal', name: 'Mystery Gift Reveal', emoji: '🎁', category: 'Celebrate',
    description: 'Build the suspense, then reveal the real gift with a photo and a message.',
    occasions: ['birthday', 'anniversary', 'appreciation'], palette: 'sunrise', motion: 'full',
    customize: ['Teaser lines', 'What the gift is', 'A photo of the gift'],
    scenes: [
      opening('Something is coming', 'A surprise for {to}', 'I’ve been keeping a secret…'),
      { kind: 'game', title: 'The reveal', transition: 'zoom', blocks: [b('gift_reveal', {
        anticipation: ['I’ve been planning this for a while…', 'Are you ready?'],
        stages: [{ label: 'Hint one', message: 'It’s something you’ve wanted for ages.' }, { label: 'Hint two', message: 'You’ll need to clear your calendar.' }],
        gift: { title: 'Your gift!', message: 'Say what the gift is and why you chose it.' },
      })] },
      finale('Enjoy it!', 'You deserve every bit of it.'),
    ],
  },
  {
    id: 'our-soundtrack', name: 'Our Soundtrack', emoji: '🎶', category: 'Music',
    description: 'The songs of your story, with a voice note to finish.',
    occasions: ['anniversary', 'friendship', 'just_because'], palette: 'midnight', motion: 'gentle',
    customize: ['Three songs (audio files)', 'Why each song matters', 'A voice note'],
    scenes: [
      opening('Press play', 'The soundtrack of {to} & {from}', 'Headphones on. These songs are us.'),
      { kind: 'media', title: 'Track 1', transition: 'fade', blocks: [b('audio', { title: 'Track 1 — the song that started it', note: 'Why this song?' })] },
      { kind: 'media', title: 'Track 2', transition: 'fade', blocks: [b('audio', { title: 'Track 2 — our road-trip song', note: 'Why this song?' })] },
      { kind: 'media', title: 'Track 3', transition: 'fade', blocks: [b('audio', { title: 'Track 3 — the one that’s just us', note: 'Why this song?' })] },
      { kind: 'finale', title: 'Finale', transition: 'zoom', blocks: [b('heading', { text: 'One last thing', size: 'lg', kicker: '' }), b('audio', { title: 'A voice note from me', note: '' }), b('confetti', { intensity: 'gentle' })] },
    ],
  },
  {
    id: 'time-capsule', name: 'Time Capsule', emoji: '⏳', category: 'Letters',
    description: 'Messages that unlock over time — set a date for each chapter.',
    occasions: ['birthday', 'anniversary', 'friendship'], palette: 'lagoon', motion: 'gentle',
    customize: ['Unlock date for each capsule', 'What’s inside each'],
    scenes: [
      opening('Sealed with love', 'A time capsule for {to}', 'Some of these open today. The rest will wait for the right moment.'),
      { kind: 'content', title: 'Open now', transition: 'fade', blocks: [b('letter', { greeting: 'Hi {to},', body: 'This one is for right now. Write about today.', signoff: '— {from}' })] },
      { kind: 'content', title: 'In one month', transition: 'fade', blocks: [b('letter', { greeting: 'One month later…', body: 'Set the lock date on this scene, then write what to read then.', signoff: '— {from}' })] },
      { kind: 'content', title: 'In one year', transition: 'fade', blocks: [b('letter', { greeting: 'A year from now…', body: 'Set the lock date on this scene, then write what to read then.', signoff: '— {from}' }), b('video', { caption: 'A message from the past' })] },
      finale('See you in the future', 'I can’t wait to see who we are by the time you read the last one.'),
    ],
  },
  {
    id: 'magazine-cover', name: 'Magazine Cover', emoji: '📰', category: 'Celebrate',
    description: 'Put them on the cover: a glossy magazine issue all about them, with quotes from the “interview”.',
    occasions: ['birthday', 'appreciation', 'just_because'], palette: 'sunrise', motion: 'full',
    customize: ['The cover photo', 'Headline and cover lines', 'Their best quotes'],
    scenes: [
      opening('Hot off the press', 'Stop the presses, {to}', 'This month’s issue sold out in seconds. Guess who’s on the cover?'),
      { kind: 'media', title: 'The cover', transition: 'zoom', blocks: [b('magazine_cover', {
        masthead: 'ICON', issue: 'The {to} issue', headline: '{to}: the most iconic person we know',
        coverLines: ['Exclusive: the secret behind that laugh', '10 times they were right (we checked)', 'Style, snacks and other talents', 'Plus: why everyone wants to be their friend'],
      })] },
      { kind: 'content', title: 'The interview', transition: 'slide', blocks: [
        b('heading', { text: 'In their own words', size: 'md', kicker: 'The interview' }),
        b('quote', { text: 'Write something they always say.', by: '{to}' }),
        b('quote', { text: 'Write their best ever one-liner.', by: '{to}, probably at 2am' }),
        b('awards', { title: 'This issue’s honours', awards: [
        { emoji: '🌟', award: 'Cover star of the year', reason: 'Was there ever any doubt?' },
        { emoji: '📸', award: 'Most photogenic', reason: 'Every angle. Every time.' },
        { emoji: '💬', award: 'Most quotable', reason: 'See the interview for evidence.' },
      ] }),
      ] },
      finale('That’s a wrap', 'You make the best headlines. Thanks for being the story I love telling.', '— {from}, Editor-in-chief'),
    ],
  },
  {
    id: 'personality-awards', name: 'Personality Awards', emoji: '🏆', category: 'Friendship',
    description: 'A red-carpet ceremony of made-up trophies for everything that makes them, them.',
    occasions: ['friendship', 'birthday', 'appreciation'], palette: 'midnight', motion: 'full',
    customize: ['Award names', 'The reason for each award', 'An acceptance-speech photo'],
    scenes: [
      opening('Live from the red carpet', 'The {to} Awards', 'Tonight we honour one person, many talents. Please hold your applause.'),
      { kind: 'content', title: 'The ceremony', transition: 'zoom', blocks: [b('awards', { title: 'And the award goes to… {to}!', awards: [
        { emoji: '😂', award: 'Best laugh in a supporting role', reason: 'Contagious. Loud. Perfect.' },
        { emoji: '🧭', award: 'Lifetime achievement in getting lost', reason: 'Somehow always finds the scenic route.' },
        { emoji: '🍜', award: 'Snack curator of the year', reason: 'Never shows up empty-handed.' },
        { emoji: '🫶', award: 'Most likely to show up', reason: 'Every time it matters, no questions asked.' },
        { emoji: '✨', award: 'Main character energy', reason: 'Walks into a room and it gets better.' },
      ] }), b('heading', { text: 'The acceptance speech', size: 'md', kicker: 'On stage now' }), b('image', { caption: 'Thank you, thank you, I’d like to thank…', alt: '' })] },
      finale('The envelope, please', 'Every award tonight was easy to give. The hard part was stopping at five.'),
    ],
  },
  {
    id: 'journey-map', name: 'Our Journey Map', emoji: '🗺️', category: 'Memories',
    description: 'Every place your story has stopped, pinned on a winding route with photos.',
    occasions: ['anniversary', 'friendship', 'just_because'], palette: 'lagoon', motion: 'gentle',
    customize: ['The places on your route', 'A photo for each stop', 'Your favourite snapshots'],
    scenes: [
      opening('Pack your bags', 'Where we’ve been, {to}', 'Some places are just places. These ones are ours.'),
      { kind: 'content', title: 'The route', transition: 'slide', blocks: [b('journey', { title: 'Our journey so far', stops: [
        { emoji: '📍', place: 'Where we met', dateLabel: 'The beginning', note: 'Write what you remember about that day.' },
        { emoji: '☕', place: 'Our usual spot', dateLabel: '', note: 'The place that became ours.' },
        { emoji: '✈️', place: 'Our first trip', dateLabel: '', note: 'Where did you go? What went wrong (and right)?' },
        { emoji: '🏡', place: 'Right here, right now', dateLabel: 'Today', note: 'Where the story is today.' },
      ] }), b('heading', { text: 'Postcards from the road', size: 'md', kicker: '' }), photos(4, 'polaroid', ['Wish you were here', 'Lost, but happy', 'Best view', 'Next stop?'])] },
      finale('Next destination: anywhere', 'Every road is better with you on it. Where shall we go next?'),
    ],
  },
  {
    id: 'countdown-surprise', name: 'Countdown Surprise', emoji: '⏰', category: 'Celebrate',
    description: 'A live countdown to the big day, with a secret to scratch off while they wait.',
    occasions: ['birthday', 'anniversary', 'custom'], palette: 'candy', motion: 'full',
    customize: ['Set the countdown date (it starts as 1 January 2027)', 'The message when it hits zero', 'The secret under the scratch card'],
    scenes: [
      opening('Tick tock', 'Something is coming, {to}', 'Mark your calendar. The clock is already running.'),
      { kind: 'game', title: 'The countdown', transition: 'zoom', blocks: [b('countdown', { target: '2027-01-01T00:00:00.000Z', title: 'Until the big day', doneMessage: 'It’s here! Today is the day.' }), b('handwritten', { text: 'Can’t wait? Neither can I. Scratch below for a sneak peek…' }), b('scratch_reveal', { prompt: 'Scratch for a clue', hiddenText: 'Write a hint about what’s coming (but don’t give it all away!)' })] },
      finale('See you soon', 'Every second on that clock is a second closer to you. I’m counting too.'),
    ],
  },
  {
    id: 'mini-game', name: 'Mini Game Experience', emoji: '🕹️', category: 'Games',
    description: 'A little arcade made for them: a memory game, a pop quiz and a prize at the end.',
    occasions: ['birthday', 'friendship', 'just_because'], palette: 'candy', motion: 'full',
    customize: ['Pairs that mean something to you two', 'Quiz questions and answers', 'The prize in the final letter'],
    scenes: [
      opening('Player one, ready?', 'Game on, {to}!', 'Two levels. One prize. No cheat codes.'),
      { kind: 'game', title: 'Level 1: Memory match', transition: 'zoom', blocks: [b('memory_match', { title: 'Find our favourite things', pairs: [
        { emoji: '🍕', label: 'Pizza nights' }, { emoji: '🎬', label: 'Movie marathons' }, { emoji: '🌊', label: 'Beach days' },
        { emoji: '☕', label: 'Coffee runs' }, { emoji: '🎤', label: 'Bad karaoke' }, { emoji: '🐶', label: 'That one dog' },
      ] })] },
      { kind: 'game', title: 'Level 2: Pop quiz', transition: 'slide', blocks: [b('quiz', {
        questions: [
          { question: 'Who is the better cook?', options: ['Me', 'You', 'Neither', 'The delivery guy'], correctIndex: 3, reveal: 'We both know it.' },
          { question: 'Our go-to late-night snack?', options: ['Chips', 'Noodles', 'Ice cream', 'Toast'], correctIndex: 1, reveal: 'Change the options to match you.' },
          { question: 'Who falls asleep first during movies?', options: ['Me', 'You', 'Both', 'Neither'], correctIndex: 1, reveal: 'Every. Single. Time.' },
          { question: 'Where should we go next?', options: ['Mountains', 'Beach', 'City', 'Anywhere with you'], correctIndex: 3, reveal: '' },
        ],
        results: { high: 'High score! You’re a legend.', medium: 'Respectable. Rematch soon?', low: 'Game over… but you still win, because you’ve got me.' },
      })] },
      finale('You win!', 'Final score: you, infinity. Your prize: write it here — a trip, a dinner, a promise. Thanks for being my favourite player two.'),
    ],
  },
]

/** "Start from a blank canvas": the smallest useful story, not listed with the templates. */
export const BLANK: Template = {
  id: 'blank', name: 'Blank canvas', emoji: '✨', category: 'Celebrate', description: 'An opening and a finale — build everything in between yourself.',
  occasions: ['just_because'], palette: 'candy', motion: 'full', customize: ['Everything'],
  scenes: [
    opening('A surprise for you', 'Hi {to}', 'I made something for you.'),
    { kind: 'content', title: 'Scene 2', transition: 'slide', blocks: [b('heading', { text: 'Your first scene', size: 'lg', kicker: '' })] },
    finale('With love', 'Write your closing message here.'),
  ],
}

export const templateById = (id: string) => (id === BLANK.id ? BLANK : TEMPLATES.find((t) => t.id === id))
