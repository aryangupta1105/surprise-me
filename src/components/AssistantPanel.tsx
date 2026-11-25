'use client'

import { useState } from 'react'
import { Button, Modal, Textarea, api, useToast } from '@/components/ui'
import type { SurpriseDoc } from '@/engine/doc'

type Result = { doc: SurpriseDoc; summary: string; changes: string[]; skipped: { op: { op: string }; reason: string }[] }

const SUGGESTIONS = ['Make it funnier', 'Add a scene about…', 'Shorten everything', 'Make it more romantic']

/** "✨ AI assistant": instruction → proposed changes with a readable diff → Accept (one undo-able edit) or Discard. */
export function AssistantPanel({ surpriseId, getDoc, onAccept }: { surpriseId: string; getDoc: () => SurpriseDoc; onAccept: (doc: SurpriseDoc) => void }) {
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<Result | null>(null)
  const [before, setBefore] = useState<SurpriseDoc | null>(null)

  const send = async () => {
    setBusy(true)
    try {
      const doc = getDoc()
      setResult(await api<Result>(`/api/surprises/${surpriseId}/assistant`, { body: { doc, instruction: text } }))
      setBefore(doc)
    } catch (e) {
      toast((e as Error).message, 'bad')
    } finally {
      setBusy(false)
    }
  }
  const discard = () => { setResult(null); setBefore(null) }
  const accept = () => {
    if (!result) return
    onAccept(result.doc)
    toast(`Applied ${result.changes.length} change(s) — Undo brings back what you had`, 'good')
    discard()
    setText('')
    setOpen(false)
  }

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>✨ AI assistant</Button>
      <Modal open={open} onClose={() => !busy && setOpen(false)} title="✨ AI assistant">
        {!result ? (
          <div className="space-y-3">
            <p className="text-sm text-ink-soft">Tell it what to change. It only uses what is already in your surprise — anything it doesn’t know becomes a [placeholder] for you to fill in.</p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button key={s} type="button" onClick={() => setText(s)} className="h-8 px-3 rounded-full bg-white ring-1 ring-line text-sm font-semibold hover:ring-rose">{s}</button>
              ))}
            </div>
            <Textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} rows={3} placeholder="e.g. Add a scene about our Goa trip after the photos" aria-label="Instruction for the AI assistant"
              onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && text.trim().length >= 3) send() }} />
            <div className="flex justify-end"><Button onClick={send} loading={busy} disabled={busy || text.trim().length < 3}>{busy ? 'Thinking…' : 'Send'}</Button></div>
          </div>
        ) : (
          <div className="space-y-4 max-h-[65dvh] overflow-y-auto">
            <p className="rounded-2xl bg-cream p-3 text-sm">{result.summary}</p>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-ink-soft mb-1">Changes</h3>
              {result.changes.length ? (
                <ul className="list-disc pl-5 text-sm space-y-0.5">{result.changes.map((c, i) => <li key={i}>{c}</li>)}</ul>
              ) : <p className="text-sm text-ink-soft">No changes could be made.</p>}
            </div>
            {result.skipped.length > 0 && (
              <div>
                <h3 className="text-xs font-bold uppercase tracking-widest text-ink-soft mb-1">Skipped</h3>
                <ul className="list-disc pl-5 text-sm space-y-0.5 text-ink-soft">{result.skipped.map((s, i) => <li key={i}>{s.op.op.replace('_', ' ')}: {s.reason}</li>)}</ul>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              {([['Before', before], ['After', result.doc]] as const).map(([name, d]) => (
                <div key={name} className="rounded-2xl ring-1 ring-line p-3">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-ink-soft mb-1">{name}</h3>
                  <ol className="list-decimal pl-5 text-sm space-y-0.5">{d?.scenes.map((s) => <li key={s.id} className="truncate">{s.title || 'Untitled scene'}</li>)}</ol>
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={discard}>Discard</Button>
              <Button onClick={accept} disabled={!result.changes.length}>Accept</Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}

/** One-line note + "Rewrite" for a single block; the result replaces it as one undo-able edit. */
export function RewriteBar({ surpriseId, getDoc, sceneId, blockId, onDone }: { surpriseId: string; getDoc: () => SurpriseDoc; sceneId: string; blockId: string; onDone: (doc: SurpriseDoc | null) => void }) {
  const toast = useToast()
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const run = async () => {
    setBusy(true)
    try {
      const r = await api<{ doc: SurpriseDoc }>(`/api/surprises/${surpriseId}/assistant/block`, { body: { doc: getDoc(), sceneId, blockId, note } })
      toast('Rewritten — Undo brings back the old version', 'good')
      onDone(r.doc)
    } catch (e) {
      toast((e as Error).message, 'bad')
      setBusy(false)
    }
  }
  return (
    <div className="flex gap-2 mb-3">
      <input value={note} onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && !busy && run()} maxLength={300} autoFocus placeholder="Optional: how should it change? (e.g. shorter, more playful)" aria-label="Rewrite note" className="flex-1 min-w-0 rounded-2xl bg-white px-3 py-1.5 text-sm ring-1 ring-line outline-none focus:ring-2 focus:ring-rose/60" />
      <Button size="sm" onClick={run} loading={busy} disabled={busy}>✨ Rewrite</Button>
      <Button size="sm" variant="ghost" onClick={() => onDone(null)} disabled={busy}>Cancel</Button>
    </div>
  )
}
