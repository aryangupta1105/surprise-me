'use client'

import { useState } from 'react'
import { Button, Input, api } from '@/components/ui'

export function UnlockForm({ token }: { token: string }) {
  const [pw, setPw] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await api(`/api/s/${token}/unlock`, { body: { password: pw } })
      window.location.reload()
    } catch (err) {
      setError((err as Error).message)
      setBusy(false)
    }
  }
  return (
    <form onSubmit={submit} className="mt-6 space-y-3 text-left">
      <Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Password" aria-label="Password" autoFocus required />
      {error && <p className="text-sm text-rose-deep" role="alert">{error}</p>}
      <Button type="submit" className="w-full" loading={busy}>Open my surprise</Button>
    </form>
  )
}
