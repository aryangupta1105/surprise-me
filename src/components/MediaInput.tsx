'use client'

import { useEffect, useRef, useState } from 'react'
import { ACCEPT, type MediaKind, uploadMedia } from '@/lib/upload-client'
import { api, useToast } from './ui'

type Item = { id: string; kind: MediaKind; name: string; size: number }
const WORD: Record<MediaKind, string> = { image: 'photo', audio: 'audio', video: 'video' }
const src = (id: string) => `/api/uploads/${id}`

/** Pick a photo, audio clip or video for a field: upload a new one, record a voice note, or reuse one from this surprise's library. */
export function MediaInput({ surpriseId, kind, value, onChange }: { surpriseId: string; kind: MediaKind; value?: string; onChange: (id: string | undefined) => void }) {
  const toast = useToast()
  const [progress, setProgress] = useState<number | null>(null)
  const [library, setLibrary] = useState<Item[] | null>(null)

  const upload = async (file: Blob & { name?: string }) => {
    setProgress(0)
    try {
      onChange(await uploadMedia(file, surpriseId, kind, setProgress))
    } catch (e) {
      toast((e as Error).message, 'bad')
    } finally {
      setProgress(null)
    }
  }
  const openLibrary = async () => {
    if (library) return setLibrary(null)
    try {
      setLibrary((await api<{ media: Item[] }>(`/api/uploads?surpriseId=${encodeURIComponent(surpriseId)}&kind=${kind}`)).media)
    } catch (e) {
      toast((e as Error).message, 'bad')
    }
  }
  const removeFromLibrary = async (id: string) => {
    if (!confirm(`Delete this ${WORD[kind]} from the surprise? Anywhere it's used will show an empty space.`)) return
    await api(`/api/uploads/${id}`, { method: 'DELETE' }).catch((e) => toast(e.message, 'bad'))
    setLibrary((l) => l?.filter((x) => x.id !== id) ?? null)
    if (value === id) onChange(undefined)
  }

  const busy = progress !== null
  const pill = 'inline-flex h-9 items-center px-3.5 rounded-full bg-white ring-1 ring-line text-sm font-semibold cursor-pointer hover:ring-ink/30 disabled:opacity-50'
  return (
    <div className="space-y-2">
      {value && <Preview kind={kind} id={value} />}
      <div className="flex flex-wrap items-center gap-2">
        <label className={pill}>
          {busy ? `Uploading… ${Math.round((progress ?? 0) * 100)}%` : value ? `Replace ${WORD[kind]}` : `Add ${kind === 'image' ? 'a photo' : kind === 'audio' ? 'audio' : 'a video'}`}
          <input type="file" accept={ACCEPT[kind]} className="sr-only" disabled={busy} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) upload(f) }} />
        </label>
        {kind === 'audio' && !busy && <Recorder onDone={(b) => upload(Object.assign(b, { name: 'Voice note' }))} />}
        <button type="button" className={pill} onClick={openLibrary} disabled={busy}>{library ? 'Close library' : 'Library'}</button>
        {value && !busy && <button type="button" className="text-sm text-ink-soft hover:text-ink" onClick={() => onChange(undefined)}>Remove</button>}
      </div>
      {library && (
        <div className="rounded-2xl ring-1 ring-line p-2">
          {library.length === 0 ? (
            <p className="text-sm text-ink-soft p-2">Nothing here yet — anything you upload to this surprise shows up here.</p>
          ) : (
            <ul className={kind === 'image' ? 'grid grid-cols-4 gap-2' : 'space-y-1'}>
              {library.map((m) => (
                <li key={m.id} className="relative group">
                  <button type="button" onClick={() => { onChange(m.id); setLibrary(null) }} className={`w-full text-left rounded-xl hover:ring-2 ring-rose ${m.id === value ? 'ring-2' : ''}`} aria-label={`Use ${m.name || WORD[kind]}`}>
                    {kind === 'image' ? (
                      // eslint-disable-next-line @next/next/no-img-element -- private, auth-checked media
                      <img src={src(m.id)} alt="" className="aspect-square w-full rounded-xl object-cover" loading="lazy" />
                    ) : (
                      <span className="block px-3 py-2 text-sm truncate">{kind === 'audio' ? '🎵' : '🎬'} {m.name || `Untitled ${WORD[kind]}`} <span className="text-ink-soft">· {(m.size / 1048576).toFixed(1)} MB</span></span>
                    )}
                  </button>
                  <button type="button" onClick={() => removeFromLibrary(m.id)} aria-label="Delete from library" title="Delete from library" className="absolute top-1 right-1 size-6 rounded-full bg-white/90 text-xs shadow opacity-0 group-hover:opacity-100 focus:opacity-100">×</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

function Preview({ kind, id }: { kind: MediaKind; id: string }) {
  // eslint-disable-next-line @next/next/no-img-element -- private, auth-checked media
  if (kind === 'image') return <img src={src(id)} alt="" className="size-20 rounded-xl object-cover ring-1 ring-line" />
  if (kind === 'audio') return <audio src={src(id)} controls preload="metadata" className="w-full max-w-sm h-10" />
  return <video src={src(id)} controls preload="metadata" playsInline className="w-full max-w-sm rounded-xl ring-1 ring-line" />
}

const MAX_RECORD_S = 180

/** Records a voice note with the browser's own MediaRecorder (webm/opus, or mp4 on Safari). */
function Recorder({ onDone }: { onDone: (b: Blob) => void }) {
  const toast = useToast()
  const [secs, setSecs] = useState<number | null>(null)
  const rec = useRef<MediaRecorder | null>(null)

  useEffect(() => () => rec.current?.stream.getTracks().forEach((t) => t.stop()), [])
  useEffect(() => {
    if (secs === null) return
    if (secs >= MAX_RECORD_S) return void rec.current?.stop()
    const t = setTimeout(() => setSecs(secs + 1), 1000)
    return () => clearTimeout(t)
  }, [secs])

  const startRec = async () => {
    if (!window.MediaRecorder) return toast('Recording is not supported in this browser — upload an audio file instead.', 'bad')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'].find((t) => MediaRecorder.isTypeSupported(t))
      const r = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      const chunks: Blob[] = []
      r.ondataavailable = (e) => e.data.size && chunks.push(e.data)
      r.onstop = () => {
        stream.getTracks().forEach((t) => t.stop())
        setSecs(null)
        const blob = new Blob(chunks, { type: (r.mimeType || 'audio/webm').split(';')[0] })
        if (blob.size) onDone(blob)
      }
      rec.current = r
      r.start(1000)
      setSecs(0)
    } catch {
      toast('Microphone access was blocked. Allow it in your browser to record.', 'bad')
    }
  }

  if (secs === null) return <button type="button" onClick={startRec} className="inline-flex h-9 items-center gap-1.5 px-3.5 rounded-full bg-white ring-1 ring-line text-sm font-semibold hover:ring-ink/30">🎙️ Record</button>
  const mmss = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`
  return (
    <button type="button" onClick={() => rec.current?.stop()} className="inline-flex h-9 items-center gap-2 px-3.5 rounded-full bg-rose text-white text-sm font-semibold" aria-live="polite">
      <span className="size-2.5 rounded-full bg-white animate-pulse" /> Stop · {mmss} / 3:00
    </button>
  )
}
