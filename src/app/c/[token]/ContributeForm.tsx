'use client'

import { useState } from 'react'
import { Button, Field, Input, Textarea, api } from '@/components/ui'

export function ContributeForm({ token }: { token: string }) {
  const [f, setF] = useState({ name: '', message: '' })
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle')
  const [error, setError] = useState<string | null>(null)
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setState('busy')
    setError(null)
    try {
      await api(`/api/c/${token}`, { body: f })
      setState('done')
    } catch (err) {
      setError((err as Error).message)
      setState('idle')
    }
  }
  if (state === 'done')
    return (
      <div className="mt-8 rounded-[1.75rem] bg-white ring-1 ring-line p-6">
        <p className="font-semibold">Thank you — your message is in! 🎉</p>
        <p className="text-sm text-ink-soft mt-2">Want to make a surprise of your own?</p>
        <Button href="/create" className="mt-4">Make one — free, no sign-up</Button>
      </div>
    )
  return (
    <form onSubmit={submit} className="mt-8 space-y-4 text-left">
      <Field label="Your name">{(id) => <Input id={id} value={f.name} maxLength={60} required onChange={(e) => setF({ ...f, name: e.target.value })} />}</Field>
      <Field label="Your message">{(id) => <Textarea id={id} rows={5} value={f.message} maxLength={500} required onChange={(e) => setF({ ...f, message: e.target.value })} />}</Field>
      {error && <p className="text-sm text-rose-deep" role="alert">{error}</p>}
      <Button type="submit" className="w-full" size="lg" loading={state === 'busy'}>Add my message</Button>
    </form>
  )
}
