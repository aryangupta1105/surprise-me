import type { Palette } from '@/lib/schemas'
import { BLOCKS } from './blocks'
import { parseDoc, uid, type Scene, type SurpriseDoc } from './doc'
import { templateById, type Template } from '@/templates/library'

// Template composition: merges the *scene structures* of several templates into one document, or inserts one
// template into an existing document. Pure; the API runs it on the server and the result is re-validated.

export const MAX_SCENES = 30
export type Names = { to: string; from: string }
export type ComposeOptions = Names & {
  palette?: Palette // overall theme the creator chose; defaults to the first template's
  motion?: 'full' | 'gentle' | 'off'
  keepTemplateColours?: boolean // keep each template's own palette on its scenes where it fits the overall theme
  openingFrom?: string // template id whose opening to keep (default: the first that has one)
  finaleFrom?: string
}
export type Skipped = { template: string; scene: string }

const DARK = new Set<Palette>(['midnight'])
/** A light palette next to a dark one jars mid-story, so scene colours are only kept within the same family. */
export const compatible = (a: Palette, b: Palette) => DARK.has(a) === DARK.has(b)

/** A template's scenes with fresh ids and the names filled in (text is JSON-escaped before substitution). */
export function instantiate(t: Template, names: Names): Scene[] {
  const esc = (s: string) => JSON.stringify(s.trim()).slice(1, -1)
  const json = JSON.stringify(t.scenes).replaceAll('{to}', esc(names.to || 'you')).replaceAll('{from}', esc(names.from || 'me'))
  return (JSON.parse(json) as Template['scenes']).map((s) => ({ ...s, id: uid(), blocks: s.blocks.map((b) => ({ ...b, id: uid() })) }))
}

function styleScenes(scenes: Scene[], t: Template, theme: SurpriseDoc['theme'], keepColours: boolean): Scene[] {
  return scenes.map((s) => {
    const own = s.palette ?? (keepColours ? t.palette : undefined)
    const palette = own && own !== theme.palette && compatible(own, theme.palette) ? own : undefined
    // Big transitions only when the creator wants full motion; otherwise fade (and keep 'none').
    const transition = theme.motion === 'full' || s.transition === 'none' ? s.transition : 'fade'
    return { ...s, palette, transition }
  })
}

const need = (id: string) => {
  const t = templateById(id)
  if (!t) throw new Error(`Unknown template "${id}"`)
  return t
}
const tooMany = (n: number) => new Error(`That would make ${n} scenes; a surprise can have up to ${MAX_SCENES}. Remove a template or some scenes.`)

/** Merges templates: one opening and one finale, every template's content scenes in the order chosen. */
export function composeTemplates(ids: string[], o: ComposeOptions): { doc: SurpriseDoc; skipped: Skipped[] } {
  const ts = [...new Set(ids)].map(need)
  if (!ts.length) throw new Error('Pick at least one template.')
  const theme = { palette: o.palette ?? ts[0].palette, motion: o.motion ?? ts[0].motion }
  const has = (t: Template, kind: Scene['kind']) => t.scenes.some((s) => s.kind === kind)
  const openT = ts.find((t) => t.id === o.openingFrom && has(t, 'opening')) ?? ts.find((t) => has(t, 'opening'))
  const endT = ts.find((t) => t.id === o.finaleFrom && has(t, 'finale')) ?? ts.find((t) => has(t, 'finale'))

  const opening: Scene[] = []
  const content: Scene[] = []
  const end: Scene[] = []
  const skipped: Skipped[] = []
  for (const t of ts) {
    for (const s of styleScenes(instantiate(t, o), t, theme, Boolean(o.keepTemplateColours))) {
      if (s.kind === 'opening' && t !== openT) skipped.push({ template: t.name, scene: s.title })
      else if (s.kind === 'finale' && t !== endT) skipped.push({ template: t.name, scene: s.title })
      else (s.kind === 'opening' ? opening : s.kind === 'finale' ? end : content).push(s)
    }
  }
  const scenes = [...opening, ...content, ...end]
  if (scenes.length > MAX_SCENES) throw tooMany(scenes.length)
  return { doc: parseDoc({ version: 1, theme, scenes }), skipped }
}

/**
 * Inserts a template's content scenes into an existing document at `at` (never after its finale).
 * Its opening/finale are only added when the document has none of its own.
 */
export function insertTemplate(doc: SurpriseDoc, id: string, at: number, names: Names, keepColours = false): { doc: SurpriseDoc; skipped: Skipped[] } {
  const t = need(id)
  const hasOpening = doc.scenes.some((s) => s.kind === 'opening')
  const hasFinale = doc.scenes.some((s) => s.kind === 'finale')
  const skipped: Skipped[] = []
  const add: Scene[] = []
  let opening: Scene | undefined
  let end: Scene | undefined
  for (const s of styleScenes(instantiate(t, names), t, doc.theme, keepColours)) {
    if (s.kind === 'opening') hasOpening ? skipped.push({ template: t.name, scene: s.title }) : (opening = s)
    else if (s.kind === 'finale') hasFinale ? skipped.push({ template: t.name, scene: s.title }) : (end = s)
    else add.push(s)
  }
  const finaleAt = doc.scenes.findIndex((s) => s.kind === 'finale')
  const i = Math.max(0, Math.min(at, finaleAt < 0 ? doc.scenes.length : finaleAt))
  const scenes = [...(opening ? [opening] : []), ...doc.scenes.slice(0, i), ...add, ...doc.scenes.slice(i), ...(end ? [end] : [])]
  if (scenes.length > MAX_SCENES) throw tooMany(scenes.length)
  return { doc: parseDoc({ ...doc, scenes }), skipped }
}

export type MissingMedia = { sceneId: string; scene: string; block: string; kind: 'image' | 'audio' | 'video' }

/** Empty photo/audio/video slots in blocks that need them (optional photos on timeline moments, letters and gifts don't count). */
export function missingMedia(doc: SurpriseDoc): MissingMedia[] {
  const out: MissingMedia[] = []
  for (const s of doc.scenes)
    for (const b of s.blocks) {
      const p = b.props as Record<string, unknown> & { items?: { photoId?: string }[] }
      const miss = (kind: MissingMedia['kind']) => out.push({ sceneId: s.id, scene: s.title, block: BLOCKS[b.type].label, kind })
      if (b.type === 'image' && !p.photoId) miss('image')
      if (b.type === 'gallery') p.items?.forEach((it) => !it.photoId && miss('image'))
      if (b.type === 'audio' && !p.audioId) miss('audio')
      if (b.type === 'video' && !p.videoId) miss('video')
    }
  return out
}
