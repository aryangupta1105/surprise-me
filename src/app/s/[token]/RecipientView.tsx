'use client'

import { useCallback, useEffect } from 'react'
import { Experience } from '@/components/experiences/Experience'
import type { StoredContent, Theme } from '@/lib/schemas'

const ping = (token: string, body: object) =>
  fetch(`/api/s/${token}/engagement`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), keepalive: true }).catch(() => {})

export function RecipientView({ token, content, theme }: { token: string; content: StoredContent; theme: Theme }) {
  useEffect(() => {
    // Count each browser session's open once.
    const key = `opened:${token.slice(0, 8)}`
    try {
      if (sessionStorage.getItem(key)) return
      sessionStorage.setItem(key, '1')
    } catch {}
    ping(token, { type: 'open' })
  }, [token])
  const onProgress = useCallback((percent: number) => ping(token, { type: 'progress', percent }), [token])
  return <Experience content={content} theme={theme} photo={(id) => (id ? `/api/s/${token}/photo/${id}` : null)} onProgress={onProgress} />
}
