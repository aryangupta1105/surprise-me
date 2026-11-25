import { z } from 'zod'
import { MOTION, PALETTES } from '@/lib/schemas'
import { BLOCKS, BLOCK_TYPES, type BlockType } from './blocks'

// A surprise is a document: theme + ordered scenes, each with ordered blocks.
// Block props are validated against the registry, so nothing outside approved types can be rendered.

export const TRANSITIONS = ['fade', 'slide', 'zoom', 'flip', 'none'] as const
export const SCENE_KINDS = ['opening', 'content', 'game', 'media', 'finale'] as const

const Id = z.string().min(1).max(40)

export const Block = z.object({
  id: Id,
  type: z.enum(BLOCK_TYPES as [BlockType, ...BlockType[]]),
  props: z.record(z.string(), z.unknown()),
})
export type Block = z.infer<typeof Block>

export const Scene = z.object({
  id: Id,
  kind: z.enum(SCENE_KINDS),
  title: z.string().max(120).default(''),
  palette: z.enum(PALETTES).optional(), // overrides the document palette for this scene
  transition: z.enum(TRANSITIONS).default('fade'),
  unlockAt: z.string().datetime().optional(), // progressive reveal: content withheld until then
  blocks: z.array(Block).max(20),
})
export type Scene = z.infer<typeof Scene>

export const DocTheme = z.object({ palette: z.enum(PALETTES), motion: z.enum(MOTION).default('full') })

export const SurpriseDoc = z
  .object({ version: z.literal(1), theme: DocTheme, scenes: z.array(Scene).min(1).max(30) })
  .superRefine((doc, ctx) => {
    doc.scenes.forEach((scene, si) =>
      scene.blocks.forEach((block, bi) => {
        const r = BLOCKS[block.type].schema.safeParse(block.props)
        if (!r.success)
          for (const issue of r.error.issues)
            ctx.addIssue({ code: 'custom', message: issue.message, path: ['scenes', si, 'blocks', bi, 'props', ...issue.path] })
      }),
    )
    const ids = doc.scenes.flatMap((s) => [s.id, ...s.blocks.map((b) => b.id)])
    if (new Set(ids).size !== ids.length) ctx.addIssue({ code: 'custom', message: 'Duplicate scene or block id' })
  })
export type SurpriseDoc = z.infer<typeof SurpriseDoc>

/** Parses a document and normalises every block's props through its own schema (applies defaults). */
export function parseDoc(input: unknown): SurpriseDoc {
  const doc = SurpriseDoc.parse(input)
  return {
    ...doc,
    scenes: doc.scenes.map((s) => ({ ...s, blocks: s.blocks.map((b) => ({ ...b, props: BLOCKS[b.type].schema.parse(b.props) as Record<string, unknown> })) })),
  }
}

export const uid = () => globalThis.crypto.randomUUID().replace(/-/g, '').slice(0, 16)
