'use client'

import { connect, loadConnectScript } from 'viasocket-apps/browser'
import { useCallback, useEffect, useState } from 'react'
import { openAccount } from './AccountDialog'
import { Button, Chip, Spinner, api, useToast } from './ui'

export type AppKey = 'gmail' | 'calendar'
type Conn = { app: AppKey; label: string | null; authId: string; expired: boolean; missing: boolean }
type State = { connections: Conn[]; token: string; apps: Record<AppKey, { serviceId: string; actionId: string }>; accountRequired?: boolean }

const NAMES: Record<AppKey, { name: string; icon: string; why: string }> = {
  gmail: { name: 'Gmail', icon: 'https://stuff.thingsofbrand.com/gmail.com/images/imge_idrA5FDGTH_1763454052978.svg', why: 'Send surprises from your own address.' },
  calendar: { name: 'Google Calendar', icon: 'https://stuff.thingsofbrand.com/google.com/images/img7_Google-Calendar.png', why: 'Add reminders before the big day.' },
}

/** Connections for the signed-in user. The embed token is signed on our server for this user only. */
export function useConnections() {
  const [state, setState] = useState<State | null>(null)
  const [error, setError] = useState<string | null>(null)
  const refresh = useCallback(async () => {
    try {
      setState(await api<State>('/api/integrations'))
      setError(null)
    } catch (e) {
      setError((e as Error).message)
    }
  }, [])
  useEffect(() => {
    api<State>('/api/integrations').then(setState, (e) => setError((e as Error).message))
    loadConnectScript().catch(() => {}) // load early: the popup must open straight from the click
    // The browser's embed token is short-lived; refresh it every 45 minutes.
    const t = setInterval(refresh, 45 * 60_000)
    return () => clearInterval(t)
  }, [refresh])
  const get = (app: AppKey) => state?.connections.find((c) => c.app === app && !c.missing) ?? null
  return { state, error, refresh, get }
}

export function ConnectRow({ app, conns }: { app: AppKey; conns: ReturnType<typeof useConnections> }) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const conn = conns.get(app)
  const info = NAMES[app]

  const save = async (authId: string) => {
    await api('/api/integrations', { body: { app, authId } })
    await conns.refresh()
    toast(`${info.name} connected`, 'good')
  }

  const onConnect = async () => {
    const s = conns.state
    if (!s) return
    setBusy(true)
    try {
      const { authId } = await connect({
        embedToken: s.token,
        serviceId: s.apps[app].serviceId,
        // Gmail: Send_Email's listed scopes miss one it uses (ListSendAs), so consent must cover the whole plug.
        // VIASOCKET-PENDING(row0904nyxej): narrow back to [actionId] once viaSocket fixes the action's scopes.
        ...(app === 'gmail' ? {} : { actions: [s.apps[app].actionId], skipActionSelection: true }),
        authId: conn?.authId, // reconnects in place (same auth_id), granting any missing permissions
        onLateSuccess: ({ authId }) => save(authId).catch((e) => toast((e as Error).message, 'bad')),
      })
      await save(authId)
    } catch (e) {
      const code = (e as { code?: string }).code
      if (code !== 'closed') toast((e as Error).message || 'Could not connect.', 'bad')
    } finally {
      setBusy(false)
    }
  }

  const onDisconnect = async () => {
    if (!confirm(`Disconnect ${info.name}? Scheduled emails using it will fail until you reconnect.`)) return
    setBusy(true)
    try {
      await api(`/api/integrations?app=${app}`, { method: 'DELETE' })
      await conns.refresh()
    } catch (e) {
      toast((e as Error).message, 'bad')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex items-center gap-4 rounded-2xl bg-white ring-1 ring-line p-4">
      {/* eslint-disable-next-line @next/next/no-img-element -- third-party app icon */}
      <img src={info.icon} alt="" className="size-10 object-contain" />
      <div className="flex-1 min-w-0">
        <p className="font-semibold flex items-center gap-2">
          {info.name}
          {conn && !conn.expired && <Chip tone="good">Connected</Chip>}
          {conn?.expired && <Chip tone="warn">Needs reconnecting</Chip>}
        </p>
        <p className="text-sm text-ink-soft truncate">{conn?.label ?? info.why}</p>
      </div>
      {conns.state?.accountRequired ? (
        <Button size="sm" variant="secondary" onClick={() => openAccount(`Create a free account to connect ${info.name} — it takes a few seconds and keeps everything you've made.`)}>Create free account</Button>
      ) : !conns.state ? (
        conns.error ? <span className="text-xs text-rose-deep max-w-40">{conns.error}</span> : <Spinner />
      ) : conn && !conn.expired ? (
        <div className="flex gap-1">
          <Button size="sm" variant="secondary" onClick={onConnect} loading={busy}>Reconnect</Button>
          <Button size="sm" variant="ghost" onClick={onDisconnect} disabled={busy}>Disconnect</Button>
        </div>
      ) : (
        <Button size="sm" onClick={onConnect} loading={busy}>{conn?.expired ? 'Reconnect' : 'Connect'}</Button>
      )}
    </div>
  )
}
