'use client'

import { useEffect, useState } from 'react'
import { Button, Field, Input, Modal, api, cx, useToast } from './ui'

// One sign-up / sign-in dialog for the whole app. It opens when:
//  - the user clicks "Sign in" / "Create free account" anywhere (openAccount()), or
//  - any request comes back with code 'account_required' (see api() in ui.tsx), showing why.
// Guests keep everything they made: signing up turns the guest into the account.

export const openAccount = (reason?: string, mode: 'signup' | 'signin' = 'signup') =>
  window.dispatchEvent(new CustomEvent('sm:account', { detail: { reason, mode } }))

export function AccountDialog() {
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<'signup' | 'signin'>('signup')
  const [reason, setReason] = useState<string | undefined>()
  const [f, setF] = useState({ name: '', email: '', password: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const on = (e: Event) => {
      const d = (e as CustomEvent<{ reason?: string; mode?: 'signup' | 'signin' }>).detail ?? {}
      setReason(d.reason)
      setMode(d.mode ?? 'signup')
      setError(null)
      setOpen(true)
    }
    window.addEventListener('sm:account', on)
    return () => window.removeEventListener('sm:account', on)
  }, [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await api(`/api/auth/${mode}`, { body: mode === 'signup' ? f : { email: f.email, password: f.password } })
      toast(mode === 'signup' ? 'Account created — everything you made is saved to it ✨' : 'Welcome back!', 'good')
      setOpen(false)
      window.location.reload() // every page re-reads who is signed in
    } catch (err) {
      const e2 = err as Error & { code?: string }
      if (e2.code === 'exists') setMode('signin')
      setError(e2.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} onClose={() => setOpen(false)} title={mode === 'signup' ? 'Create your free account' : 'Sign in'}>
      {reason && <p className="mb-4 rounded-2xl bg-cream p-3 text-sm">{reason}</p>}
      <div className="inline-flex rounded-full bg-white ring-1 ring-line p-1 mb-5" role="tablist">
        {(['signup', 'signin'] as const).map((m) => (
          <button key={m} role="tab" aria-selected={mode === m} onClick={() => { setMode(m); setError(null) }} className={cx('h-9 px-4 rounded-full text-sm font-semibold', mode === m ? 'bg-ink text-white' : 'text-ink-soft')}>
            {m === 'signup' ? 'New here' : 'I have an account'}
          </button>
        ))}
      </div>
      <form onSubmit={submit} className="space-y-3">
        {mode === 'signup' && <Field label="Your name" optional>{(id) => <Input id={id} value={f.name} maxLength={60} autoComplete="name" onChange={(e) => setF({ ...f, name: e.target.value })} />}</Field>}
        <Field label="Email">{(id) => <Input id={id} type="email" required value={f.email} maxLength={200} autoComplete="email" onChange={(e) => setF({ ...f, email: e.target.value })} />}</Field>
        <Field label="Password" hint={mode === 'signup' ? 'At least 8 characters.' : undefined}>
          {(id) => <Input id={id} type="password" required minLength={mode === 'signup' ? 8 : 1} value={f.password} maxLength={200} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} onChange={(e) => setF({ ...f, password: e.target.value })} />}
        </Field>
        {error && <p className="text-sm text-rose-deep" role="alert">{error}</p>}
        <Button type="submit" className="w-full" size="lg" loading={busy}>{mode === 'signup' ? 'Create account' : 'Sign in'}</Button>
        {mode === 'signup' && <p className="text-xs text-ink-soft text-center">Free. Everything you made as a guest comes with you. No spam, ever.</p>}
      </form>
    </Modal>
  )
}

/** Header control: "Sign in" for guests, the account name for members. */
export function AccountButton({ user }: { user: { isGuest: boolean; name: string | null; email: string | null } | null }) {
  if (user && !user.isGuest)
    return <a href="/settings" className="hidden sm:block px-3 py-2 rounded-full hover:bg-ink/5 max-w-40 truncate" title={user.email ?? ''}>{user.name || user.email}</a>
  return <button onClick={() => openAccount(undefined, 'signin')} className="px-3 py-2 rounded-full hover:bg-ink/5">Sign in</button>
}
