import { BLOCKS, type BlockType } from './blocks'
import { SurpriseDoc, uid, type Block, type Scene } from './doc'

// Pure document operations. The editor, the AI assistant and templates all change documents only through
// these, and every result is re-validated, so no path can produce a document the player cannot render.

const valid = (doc: SurpriseDoc) => SurpriseDoc.parse(doc)
const at = (doc: SurpriseDoc, sceneId: string) => {
  const i = doc.scenes.findIndex((s) => s.id === sceneId)
  if (i < 0) throw new Error(`Unknown scene ${sceneId}`)
  return i
}
const move = <T,>(list: T[], from: number, to: number) => {
  const copy = [...list]
  const [item] = copy.splice(from, 1)
  copy.splice(Math.max(0, Math.min(copy.length, to)), 0, item)
  return copy
}
const withScene = (doc: SurpriseDoc, sceneId: string, fn: (s: Scene) => Scene) =>
  valid({ ...doc, scenes: doc.scenes.map((s) => (s.id === sceneId ? fn(s) : s)) })

/** Fresh ids for a scene and its blocks (duplicating, inserting template scenes). */
export const cloneScene = (s: Scene): Scene => ({ ...structuredClone(s), id: uid(), blocks: s.blocks.map((b) => ({ ...structuredClone(b), id: uid() })) })

export function newBlock(type: BlockType, props?: Record<string, unknown>): Block {
  return { id: uid(), type, props: BLOCKS[type].schema.parse(props ?? BLOCKS[type].create()) as Record<string, unknown> }
}

export const addScene = (doc: SurpriseDoc, scene: Partial<Scene> & Pick<Scene, 'kind'>, index = doc.scenes.length) =>
  valid({ ...doc, scenes: move([...doc.scenes, { title: '', transition: 'fade', blocks: [], ...scene, id: uid() } as Scene], doc.scenes.length, index) })

export const removeScene = (doc: SurpriseDoc, sceneId: string) => {
  if (doc.scenes.length === 1) throw new Error('A surprise needs at least one scene')
  return valid({ ...doc, scenes: doc.scenes.filter((s) => s.id !== sceneId) })
}

export const duplicateScene = (doc: SurpriseDoc, sceneId: string) => {
  const i = at(doc, sceneId)
  return valid({ ...doc, scenes: [...doc.scenes.slice(0, i + 1), cloneScene(doc.scenes[i]), ...doc.scenes.slice(i + 1)] })
}

export const moveScene = (doc: SurpriseDoc, sceneId: string, toIndex: number) => valid({ ...doc, scenes: move(doc.scenes, at(doc, sceneId), toIndex) })

export const updateScene = (doc: SurpriseDoc, sceneId: string, patch: Partial<Omit<Scene, 'id' | 'blocks'>>) =>
  withScene(doc, sceneId, (s) => ({ ...s, ...patch }))

export const addBlock = (doc: SurpriseDoc, sceneId: string, block: Block, index?: number) =>
  withScene(doc, sceneId, (s) => ({ ...s, blocks: move([...s.blocks, block], s.blocks.length, index ?? s.blocks.length) }))

export const removeBlock = (doc: SurpriseDoc, sceneId: string, blockId: string) =>
  withScene(doc, sceneId, (s) => ({ ...s, blocks: s.blocks.filter((b) => b.id !== blockId) }))

export const duplicateBlock = (doc: SurpriseDoc, sceneId: string, blockId: string) =>
  withScene(doc, sceneId, (s) => {
    const i = s.blocks.findIndex((b) => b.id === blockId)
    if (i < 0) throw new Error(`Unknown block ${blockId}`)
    return { ...s, blocks: [...s.blocks.slice(0, i + 1), { ...structuredClone(s.blocks[i]), id: uid() }, ...s.blocks.slice(i + 1)] }
  })

export const moveBlock = (doc: SurpriseDoc, sceneId: string, blockId: string, toIndex: number) =>
  withScene(doc, sceneId, (s) => ({ ...s, blocks: move(s.blocks, s.blocks.findIndex((b) => b.id === blockId), toIndex) }))

export const updateBlockProps = (doc: SurpriseDoc, sceneId: string, blockId: string, props: Record<string, unknown>) =>
  withScene(doc, sceneId, (s) => ({ ...s, blocks: s.blocks.map((b) => (b.id === blockId ? { ...b, props: { ...b.props, ...props } } : b)) }))

export const setTheme = (doc: SurpriseDoc, theme: Partial<SurpriseDoc['theme']>) => valid({ ...doc, theme: { ...doc.theme, ...theme } })
