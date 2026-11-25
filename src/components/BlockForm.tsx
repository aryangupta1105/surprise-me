'use client'

import { useMemo } from 'react'
import { z } from 'zod'
import { BLOCKS, type BlockType } from '@/engine/blocks'
import { MediaInput } from './MediaInput'
import { Input, Select, Textarea, cx } from './ui'

// A form generated from a block's own Zod schema (via JSON Schema), so every registered block type —
// including ones added later — is editable without writing a new editor.

type JS = {
  type?: string | string[]
  enum?: unknown[]
  properties?: Record<string, JS>
  required?: string[]
  items?: JS
  maxLength?: number
  minItems?: number
  maxItems?: number
  format?: string
  default?: unknown
  anyOf?: JS[]
}

const human = (k: string) => k.replace(/(Photo|Audio|Video)Id$/, ' $1').replace(/Id$/, '').replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase())
const typeOf = (s: JS) => (Array.isArray(s.type) ? s.type.find((t) => t !== 'null') : s.type) ?? s.anyOf?.find((a) => a.type !== 'null')?.type

/** An empty value matching a schema (for "add item"). */
function blank(s: JS): unknown {
  if (s.default !== undefined) return structuredClone(s.default)
  if (s.enum) return s.enum[0]
  switch (typeOf(s)) {
    case 'string': return ''
    case 'number': case 'integer': return 0
    case 'boolean': return false
    case 'array': return Array.from({ length: s.minItems ?? 0 }, () => blank(s.items ?? {}))
    case 'object': return Object.fromEntries(Object.entries(s.properties ?? {}).filter(([k]) => s.required?.includes(k)).map(([k, v]) => [k, blank(v)]))
  }
  return ''
}

export function BlockForm({ type, value, onChange, surpriseId }: { type: BlockType; value: Record<string, unknown>; onChange: (v: Record<string, unknown>) => void; surpriseId: string }) {
  const schema = useMemo(() => z.toJSONSchema(BLOCKS[type].schema as z.ZodType, { io: 'input' }) as JS, [type])
  return <ObjectFields schema={schema} value={value} onChange={onChange} surpriseId={surpriseId} />
}

function ObjectFields({ schema, value, onChange, surpriseId }: { schema: JS; value: Record<string, unknown>; onChange: (v: Record<string, unknown>) => void; surpriseId: string }) {
  return (
    <div className="space-y-3">
      {Object.entries(schema.properties ?? {}).map(([key, s]) => (
        <FieldFor key={key} name={key} schema={s} value={value?.[key]} surpriseId={surpriseId} onChange={(v) => onChange({ ...value, [key]: v })} />
      ))}
    </div>
  )
}

function FieldFor({ name, schema, value, onChange, surpriseId }: { name: string; schema: JS; value: unknown; onChange: (v: unknown) => void; surpriseId: string }) {
  const label = <span className="block text-xs font-semibold text-ink-soft mb-1">{human(name)}</span>
  const t = typeOf(schema)

  const media = name.match(/(photo|audio|video)Id$/i)?.[1].toLowerCase()
  if (media)
    return <div>{label}<MediaInput kind={media === 'photo' ? 'image' : (media as 'audio' | 'video')} surpriseId={surpriseId} value={value as string | undefined} onChange={(id) => onChange(id)} /></div>

  if (schema.enum)
    return (
      <label className="block">{label}
        <Select value={String(value ?? schema.enum[0])} onChange={(e) => onChange(e.target.value)} className="py-2">
          {schema.enum.map((o) => <option key={String(o)} value={String(o)}>{String(o)}</option>)}
        </Select>
      </label>
    )

  if (t === 'string' && schema.format === 'date-time') {
    const local = value ? new Date(new Date(value as string).getTime() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 16) : ''
    return <label className="block">{label}<Input type="datetime-local" value={local} onChange={(e) => onChange(e.target.value ? new Date(e.target.value).toISOString() : undefined)} className="py-2" /></label>
  }

  if (t === 'string') {
    const long = (schema.maxLength ?? 0) > 300
    return (
      <label className="block">{label}
        {long ? (
          <Textarea value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} maxLength={schema.maxLength} rows={value && String(value).length > 200 ? 6 : 3} />
        ) : (
          <Input value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} maxLength={schema.maxLength} className="py-2" />
        )}
      </label>
    )
  }

  if (t === 'number' || t === 'integer')
    return <label className="block">{label}<Input type="number" value={Number(value ?? 0)} onChange={(e) => onChange(Number(e.target.value))} className="py-2 w-28" /></label>

  if (t === 'boolean')
    return <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} className="size-4" />{human(name)}</label>

  if (t === 'object')
    return (
      <fieldset className="rounded-2xl ring-1 ring-line p-3">
        <legend className="px-1 text-xs font-semibold text-ink-soft">{human(name)}</legend>
        <ObjectFields schema={schema} value={(value as Record<string, unknown>) ?? {}} onChange={onChange} surpriseId={surpriseId} />
      </fieldset>
    )

  if (t === 'array') {
    const items = (value as unknown[]) ?? []
    const item = schema.items ?? {}
    const max = schema.maxItems ?? 50
    const min = schema.minItems ?? 0
    if (typeOf(item) === 'string' && !item.enum)
      return (
        <label className="block">{label}
          <Textarea value={items.join('\n')} onChange={(e) => onChange(e.target.value.split('\n').slice(0, max))} rows={Math.min(6, Math.max(2, items.length))} />
          <span className="text-xs text-ink-soft">One per line</span>
        </label>
      )
    return (
      <div>
        {label}
        <ol className="space-y-3">
          {items.map((it, i) => (
            <li key={i} className="rounded-2xl bg-cream/60 p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-ink-soft">#{i + 1}</span>
                <span className="flex gap-1">
                  <IconBtn label="Move up" disabled={i === 0} onClick={() => onChange(swap(items, i, i - 1))}>↑</IconBtn>
                  <IconBtn label="Move down" disabled={i === items.length - 1} onClick={() => onChange(swap(items, i, i + 1))}>↓</IconBtn>
                  <IconBtn label="Remove" disabled={items.length <= min} onClick={() => onChange(items.filter((_, j) => j !== i))}>×</IconBtn>
                </span>
              </div>
              {typeOf(item) === 'object' ? (
                <ObjectFields schema={item} value={it as Record<string, unknown>} onChange={(v) => onChange(items.map((x, j) => (j === i ? v : x)))} surpriseId={surpriseId} />
              ) : (
                <FieldFor name={`${name} ${i + 1}`} schema={item} value={it} onChange={(v) => onChange(items.map((x, j) => (j === i ? v : x)))} surpriseId={surpriseId} />
              )}
            </li>
          ))}
        </ol>
        {items.length < max && (
          <button type="button" onClick={() => onChange([...items, blank(item)])} className="mt-2 text-sm font-semibold text-rose hover:text-rose-deep">+ Add {human(name).replace(/s$/, '').toLowerCase()}</button>
        )}
      </div>
    )
  }
  return null
}

const swap = <T,>(a: T[], i: number, j: number) => {
  const c = [...a]
  ;[c[i], c[j]] = [c[j], c[i]]
  return c
}

export function IconBtn({ children, label, onClick, disabled, className }: { children: React.ReactNode; label: string; onClick: () => void; disabled?: boolean; className?: string }) {
  return (
    <button type="button" aria-label={label} title={label} disabled={disabled} onClick={onClick} className={cx('size-7 rounded-full text-sm hover:bg-ink/10 disabled:opacity-30 disabled:pointer-events-none', className)}>
      {children}
    </button>
  )
}
