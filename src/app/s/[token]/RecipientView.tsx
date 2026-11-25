'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect } from 'react'
import type { SurpriseDoc } from '@/engine/doc'

// Client-only so the player can resume from localStorage without a hydration mismatch.
const Player = dynamic(() => import('@/engine/player/Player').then((m) => m.Player), {
  ssr: false,
  loading: () => <div className="min-h-dvh grid place-items-center text-4xl" aria-busy>🎁</div>,
})

const ping = (token: string, body: object) =>
  fetch(`/api/s/${token}/engagement`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), keepalive: true }).catch(() => {})

export function RecipientView({ token, doc }: { token: string; doc: SurpriseDoc }) {
  useEffect(() => {
    const key = `opened:${token.slice(0, 8)}` // count each browser session's open once
    try {
      if (sessionStorage.getItem(key)) return
      sessionStorage.setItem(key, '1')
    } catch {}
    ping(token, { type: 'open' })
  }, [token])
  const onProgress = useCallback((percent: number) => ping(token, { type: 'progress', percent }), [token])
  return <Player doc={doc} photo={(id) => (id ? `/api/s/${token}/photo/${id}` : null)} onProgress={onProgress} resumeKey={`sm:at:${token.slice(0, 8)}`} />
}
