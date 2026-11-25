'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { ConnectRow, useConnections } from '@/components/Connections'
import { Button, Card, Chip, api, useToast } from '@/components/ui'
import { ReminderCard } from '../studio/[id]/SharePanel'

type U = { isGuest: boolean; email: string | null; name: string | null } | null

export function Settings({ user, blocksReferenceId }: { user: U; blocksReferenceId: string | null }) {
  const conns = useConnections()
  const router = useRouter()
  const toast = useToast()

  const logout = async () => {
    await api('/api/auth/logout', { body: {} })
    router.push('/')
    router.refresh()
  }
  const deleteAll = async () => {
    if (!confirm('Delete your account and every surprise, photo, link and scheduled email? This cannot be undone.')) return
    try {
      await api('/api/me', { method: 'DELETE' })
      toast('Everything was deleted', 'info')
      router.push('/')
      router.refresh()
    } catch (e) {
      toast((e as Error).message, 'bad')
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-5 pb-24 space-y-6">
      <h1 className="font-display text-4xl sm:text-5xl">Settings</h1>

      <Card className="p-6 sm:p-8">
        <h2 className="font-display text-2xl flex items-center gap-3">Account {user && <Chip tone={user.isGuest ? 'info' : 'good'}>{user.isGuest ? 'guest' : 'signed in'}</Chip>}</h2>
        {user && !user.isGuest ? (
          <>
            <p className="text-ink-soft mt-2">Signed in as <b>{user.email ?? user.name}</b>. Your surprises follow you on any device.</p>
            <Button variant="secondary" className="mt-5" onClick={logout}>Sign out</Button>
          </>
        ) : (
          <>
            <p className="text-ink-soft mt-2">You’re using SurpriseMe as a guest — your work is saved to this browser. Create a free account to keep it safe and use it anywhere; everything you made comes with you.</p>
            {blocksReferenceId ? <BlocksLogin referenceId={blocksReferenceId} /> : <p className="mt-5 rounded-2xl bg-cream p-4 text-sm">Accounts are being set up — check back soon. Your guest work is safe meanwhile.</p>}
          </>
        )}
      </Card>

      <Card className="p-6 sm:p-8">
        <h2 className="font-display text-2xl">Connected apps</h2>
        <p className="text-ink-soft mt-1 text-sm">Connections run through viaSocket; SurpriseMe never sees your Google password or tokens.</p>
        <div className="mt-5 space-y-3">
          <ConnectRow app="gmail" conns={conns} />
          <ConnectRow app="calendar" conns={conns} />
        </div>
      </Card>

      {conns.get('calendar') && <ReminderCard recipientName="someone special" defaultTitle="🎁 Plan a surprise" reminders={[]} conns={conns} onCreated={async () => {}} />}

      {user && (
        <Card className="p-6 sm:p-8">
          <h2 className="font-display text-2xl">Your data</h2>
          <p className="text-ink-soft mt-1 text-sm">Delete everything: your surprises, photos, private links, scheduled emails and app connections.</p>
          <Button variant="danger" className="mt-5" onClick={deleteAll}>Delete all my data</Button>
        </Card>
      )}
    </div>
  )
}

/** 36Blocks sign-in widget (viaSocket's login product). It redirects to /api/auth/callback when done. */
function BlocksLogin({ referenceId }: { referenceId: string }) {
  useEffect(() => {
    const w = window as unknown as { initVerification?: (c: object) => void }
    const config = { referenceId, success: () => {}, failure: () => {} }
    const s = document.createElement('script')
    s.src = 'https://proxy.msg91.com/assets/proxy-auth/proxy-auth.js'
    s.onload = () => w.initVerification?.(config)
    document.body.appendChild(s)
    return () => s.remove()
  }, [referenceId])
  return <div id={referenceId} className="mt-5" />
}
