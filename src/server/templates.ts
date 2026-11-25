import 'server-only'
import { z } from 'zod'
import type { Prisma } from '@/generated/prisma/client'
import { db } from '@/lib/db'
import { AppError } from '@/lib/http'
import { MOTION, OCCASIONS, PALETTES, StudioInput } from '@/lib/schemas'
import { composeTemplates, insertTemplate, missingMedia } from '@/engine/compose'
import { parseDoc } from '@/engine/doc'
import { createDraft, ownedSurprise, saveDraftDoc } from './surprises'

// Template composition runs here, on the server, and every result is validated before it is saved.

const engine = <T,>(fn: () => T): T => {
  try {
    return fn()
  } catch (e) {
    throw new AppError(400, (e as Error).message.slice(0, 300), 'template')
  }
}

export const FromTemplatesInput = z.object({
  templateIds: z.array(z.string().max(60)).min(1, 'Pick at least one template.').max(6),
  recipientName: z.string().trim().min(1, 'Who is it for?').max(60),
  creatorName: z.string().trim().min(1, 'Add your name').max(60),
  occasion: z.enum(OCCASIONS).default('just_because'),
  palette: z.enum(PALETTES).optional(),
  motion: z.enum(MOTION).optional(),
  keepTemplateColours: z.boolean().default(false),
  openingFrom: z.string().max(60).optional(),
  finaleFrom: z.string().max(60).optional(),
})

export async function createFromTemplates(ownerId: string, i: z.infer<typeof FromTemplatesInput>) {
  const { doc, skipped } = engine(() => composeTemplates(i.templateIds, { ...i, to: i.recipientName, from: i.creatorName }))
  const s = await createDraft(ownerId, StudioInput.parse({ occasion: i.occasion, recipientName: i.recipientName, creatorName: i.creatorName }))
  await saveDraftDoc(s.id, ownerId, doc, 'template')
  const heading = doc.scenes[0].blocks.find((b) => b.type === 'heading')?.props.text
  await db.surprise.update({
    where: { id: s.id },
    data: { title: typeof heading === 'string' ? heading.slice(0, 120) : null, theme: doc.theme as Prisma.InputJsonValue, generationStatus: 'SUCCEEDED' },
  })
  return { id: s.id, skipped, missing: missingMedia(doc) }
}

/** Returns the document with the template inserted; the editor applies it (undo-able) and autosaves. */
export async function insertIntoSurprise(surpriseId: string, ownerId: string, docInput: unknown, templateId: string, at: number, keepColours: boolean) {
  const s = await ownedSurprise(surpriseId, ownerId)
  const doc = engine(() => parseDoc(docInput))
  return engine(() => insertTemplate(doc, templateId, at, { to: s.recipientName, from: s.creatorName }, keepColours))
}
