'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useState } from 'react'
import type { SurpriseDoc } from '@/engine/doc'

// Client-only so the player can resume from localStorage without a hydration mismatch.
const Player = dynamic(() => import('@/engine/player/Player').then((m) => m.Player), {
  ssr: false,
  loading: () => <div className="min-h-dvh grid place-items-center text-4xl" aria-busy>🎁</div>,
})

const post = (url: string, body: object) =>
  fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), keepalive: true })
const ping = (token: string, body: object) => post(`/api/s/${token}/engagement`, body).catch(() => {})

export function RecipientView({ token, doc, creatorName }: { token: string; doc: SurpriseDoc; creatorName: string }) {
  const [finished, setFinished] = useState(false)
  useEffect(() => {
    const key = `opened:${token.slice(0, 8)}` // count each browser session's open once
    try {
      if (sessionStorage.getItem(key)) return
      sessionStorage.setItem(key, '1')
    } catch {}
    ping(token, { type: 'open' })
  }, [token])
  const onProgress = useCallback(
    (percent: number) => {
      ping(token, { type: 'progress', percent })
      if (percent >= 100) setFinished(true)
    },
    [token],
  )
  return (
    <>
      <Player doc={doc} photo={(id) => (id ? `/api/s/${token}/photo/${id}` : null)} onProgress={onProgress} resumeKey={`sm:at:${token.slice(0, 8)}`} />
      {finished && <ReactionSheet token={token} creatorName={creatorName} />}
    </>
  )
}

const EMOJI = ['❤️', '😭', '😂', '🥹', '🎉', '🤗', '😍', '🔥'] as const

/** At the end: reply to the creator, and (quietly) make your own. */
function ReactionSheet({ token, creatorName }: { token: string; creatorName: string }) {
  const sentKey = `sm:reacted:${token.slice(0, 8)}`
  const [open, setOpen] = useState(true)
  const [emoji, setEmoji] = useState<string | null>(null)
  const [f, setF] = useState({ message: '', fromName: '' })
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>(() => {
    try { return localStorage.getItem(sentKey) ? 'sent' : 'idle' } catch { return 'idle' }
  })
  const send = async () => {
    if (!emoji) return
    setState('sending')
    const res = await post(`/api/s/${token}/reactions`, { emoji, ...f }).catch(() => null)
    if (res?.ok) {
      setState('sent')
      try { localStorage.setItem(sentKey, '1') } catch {}
    } else setState('error')
  }
  if (!open)
    return <button onClick={() => setOpen(true)} className="fixed bottom-4 right-4 z-40 h-12 px-5 rounded-full bg-white text-[#2b2320] shadow-xl font-semibold">💌 Reply</button>
  return (
    <aside className="fixed inset-x-0 bottom-0 z-40 p-3 sm:p-4" aria-label={`Reply to ${creatorName}`}>
      <div className="mx-auto max-w-md rounded-[1.75rem] bg-white text-[#2b2320] shadow-2xl p-5 relative">
        <button onClick={() => setOpen(false)} className="absolute top-3 right-3 size-8 rounded-full hover:bg-black/5" aria-label="Close">×</button>
        {state === 'sent' ? (
          <p className="font-semibold text-center py-2">Sent to {creatorName} 💌</p>
        ) : (
          <>
            <p className="font-semibold">Send {creatorName} a reaction</p>
            <div className="flex gap-1.5 mt-3 flex-wrap" role="radiogroup" aria-label="Reaction">
              {EMOJI.map((e) => (
                <button key={e} role="radio" aria-checked={emoji === e} onClick={() => setEmoji(e)} className={`size-11 rounded-2xl text-2xl transition ${emoji === e ? 'bg-black/10 scale-110' : 'hover:bg-black/5'}`}>{e}</button>
              ))}
            </div>
            {emoji && (
              <div className="mt-3 space-y-2">
                <textarea value={f.message} maxLength={500} onChange={(e) => setF({ ...f, message: e.target.value })} placeholder="Say something (optional)" rows={2} className="w-full rounded-2xl ring-1 ring-black/10 px-3 py-2 text-sm" aria-label="Message" />
                <input value={f.fromName} maxLength={60} onChange={(e) => setF({ ...f, fromName: e.target.value })} placeholder="Your name (optional)" className="w-full rounded-2xl ring-1 ring-black/10 px-3 py-2 text-sm" aria-label="Your name" />
                <button onClick={send} disabled={state === 'sending'} className="w-full h-11 rounded-full bg-[#e2557a] text-white font-semibold disabled:opacity-60">{state === 'sending' ? 'Sending…' : 'Send'}</button>
                {state === 'error' && <p className="text-sm text-[#b3264f]" role="alert">Couldn’t send — please try again.</p>}
              </div>
            )}
          </>
        )}
        <a href="/create" className="block text-center text-xs mt-4 opacity-60 hover:opacity-100">Made with SurpriseMe · make one for someone you love →</a>
      </div>
    </aside>
  )
}
