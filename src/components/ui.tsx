'use client'

import { AnimatePresence, motion } from 'framer-motion'
import Link from 'next/link'
import { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from 'react'

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')
export { cx }

// ---------- Fetch helper: JSON in/out, server error messages surfaced as Error.message ----------
export async function api<T = Record<string, unknown>>(url: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(url, {
    method: init.method ?? (init.body === undefined ? 'GET' : 'POST'),
    headers: init.body === undefined || init.body instanceof FormData ? undefined : { 'Content-Type': 'application/json' },
    body: init.body === undefined ? undefined : init.body instanceof FormData ? init.body : JSON.stringify(init.body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw Object.assign(new Error(data.error ?? `Request failed (${res.status})`), { status: res.status, code: data.code, issues: data.issues })
  return data as T
}

// ---------- Buttons ----------
type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
const variants: Record<Variant, string> = {
  primary: 'bg-rose text-white shadow-[0_8px_20px_-8px_rgb(226_85_122/0.7)] hover:bg-rose-deep',
  secondary: 'bg-white text-ink ring-1 ring-line hover:ring-ink/30',
  ghost: 'text-ink-soft hover:text-ink hover:bg-ink/5',
  danger: 'bg-white text-rose-deep ring-1 ring-rose/30 hover:bg-rose/5',
}
const sizes = { sm: 'h-9 px-4 text-sm', md: 'h-11 px-5 text-[15px]', lg: 'h-14 px-8 text-base' }
type BtnProps = { variant?: Variant; size?: keyof typeof sizes; loading?: boolean; href?: string } & React.ButtonHTMLAttributes<HTMLButtonElement>

export function Button({ variant = 'primary', size = 'md', loading, href, className, children, disabled, ...rest }: BtnProps) {
  const cls = cx(
    'inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-all active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap',
    variants[variant],
    sizes[size],
    className,
  )
  if (href) return <Link href={href} className={cls}>{children}</Link>
  return (
    <button className={cls} disabled={disabled || loading} {...rest}>
      {loading && <Spinner className="size-4" />}
      {children}
    </button>
  )
}

export const Spinner = ({ className = 'size-5' }: { className?: string }) => (
  <svg className={cx('animate-spin', className)} viewBox="0 0 24 24" fill="none" aria-hidden>
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity=".25" strokeWidth="3" />
    <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
  </svg>
)

// ---------- Surfaces ----------
export function Card({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cx('rounded-[var(--radius-card)] bg-white/85 backdrop-blur ring-1 ring-line shadow-[var(--shadow-soft)]', className)} {...rest}>{children}</div>
}

export function Chip({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'neutral' | 'good' | 'warn' | 'bad' | 'info' }) {
  const tones = { neutral: 'bg-ink/5 text-ink-soft', good: 'bg-mint/60 text-[#1f5136]', warn: 'bg-butter/70 text-[#6a4b00]', bad: 'bg-rose/10 text-rose-deep', info: 'bg-sky/50 text-[#164a6b]' }
  return <span className={cx('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold', tones[tone])}>{children}</span>
}

export function EmptyState({ emoji, title, body, action }: { emoji: string; title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center text-center py-16 px-6">
      <div className="text-5xl mb-4 float" aria-hidden>{emoji}</div>
      <h3 className="font-display text-2xl">{title}</h3>
      <p className="text-ink-soft mt-2 max-w-sm">{body}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="rounded-2xl bg-rose/5 ring-1 ring-rose/20 p-5 text-rose-deep">
      <p className="font-semibold">Something went wrong</p>
      <p className="text-sm mt-1">{message}</p>
      {onRetry && <Button size="sm" variant="danger" className="mt-3" onClick={onRetry}>Try again</Button>}
    </div>
  )
}

// ---------- Form fields ----------
export function Field({ label, hint, error, children, optional }: { label: string; hint?: string; error?: string; optional?: boolean; children: (id: string) => React.ReactNode }) {
  const id = useId()
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="flex items-baseline gap-2 text-sm font-semibold">
        {label}
        {optional && <span className="text-xs font-normal text-ink-soft">optional</span>}
      </label>
      {children(id)}
      {error ? <p className="text-sm text-rose-deep">{error}</p> : hint ? <p className="text-xs text-ink-soft">{hint}</p> : null}
    </div>
  )
}

const inputCls = 'w-full rounded-2xl bg-white px-4 py-3 ring-1 ring-line placeholder:text-ink-soft/60 focus:ring-2 focus:ring-rose/60 outline-none transition'
export const Input = (p: React.InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={cx(inputCls, p.className)} />
export const Textarea = (p: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea rows={3} {...p} className={cx(inputCls, 'resize-y', p.className)} />
export const Select = (p: React.SelectHTMLAttributes<HTMLSelectElement>) => <select {...p} className={cx(inputCls, 'appearance-none', p.className)} />

/** A growable list of short text entries (memories, inside jokes...). */
export function ListInput({ values, onChange, placeholder, max, multiline }: { values: string[]; onChange: (v: string[]) => void; placeholder: string; max: number; multiline?: boolean }) {
  const rows = values.length ? values : ['']
  const set = (i: number, v: string) => onChange(rows.map((r, j) => (j === i ? v : r)))
  return (
    <div className="space-y-2">
      {rows.map((v, i) => (
        <div key={i} className="flex gap-2 items-start">
          {multiline ? (
            <Textarea value={v} onChange={(e) => set(i, e.target.value)} placeholder={i === 0 ? placeholder : 'Another one…'} rows={2} aria-label={`${placeholder} ${i + 1}`} />
          ) : (
            <Input value={v} onChange={(e) => set(i, e.target.value)} placeholder={i === 0 ? placeholder : 'Another one…'} aria-label={`${placeholder} ${i + 1}`} />
          )}
          {rows.length > 1 && (
            <button type="button" onClick={() => onChange(rows.filter((_, j) => j !== i))} className="mt-2.5 size-8 shrink-0 rounded-full text-ink-soft hover:bg-ink/5" aria-label="Remove">×</button>
          )}
        </div>
      ))}
      {rows.length < max && rows[rows.length - 1].trim() && (
        <button type="button" onClick={() => onChange([...rows, ''])} className="text-sm font-semibold text-rose hover:text-rose-deep">+ Add another</button>
      )}
    </div>
  )
}

// ---------- Modal (native <dialog>: focus trap and Escape for free) ----------
export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])
  return (
    <dialog ref={ref} onClose={onClose} onClick={(e) => e.target === ref.current && onClose()} className="m-auto w-[min(560px,calc(100vw-2rem))] rounded-[1.75rem] p-0 backdrop:bg-ink/40 backdrop:backdrop-blur-sm shadow-[var(--shadow-lift)]">
      <div className="p-6 sm:p-8 bg-paper">
        <div className="flex items-start justify-between gap-4 mb-5">
          <h2 className="font-display text-2xl">{title}</h2>
          <button onClick={onClose} className="size-9 rounded-full hover:bg-ink/5 text-xl" aria-label="Close">×</button>
        </div>
        {children}
      </div>
    </dialog>
  )
}

// ---------- Toasts ----------
type Toast = { id: number; text: string; tone: 'good' | 'bad' | 'info' }
const ToastCtx = createContext<(text: string, tone?: Toast['tone']) => void>(() => {})
export const useToast = () => useContext(ToastCtx)

export function Toaster({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const push = useCallback((text: string, tone: Toast['tone'] = 'info') => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t, { id, text, tone }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500)
  }, [])
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div aria-live="polite" className="fixed bottom-4 inset-x-0 flex flex-col items-center gap-2 z-50 pointer-events-none px-4">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10 }}
              className={cx(
                'pointer-events-auto rounded-full px-5 py-3 text-sm font-semibold shadow-[var(--shadow-lift)]',
                t.tone === 'good' && 'bg-ink text-white',
                t.tone === 'bad' && 'bg-rose-deep text-white',
                t.tone === 'info' && 'bg-white text-ink ring-1 ring-line',
              )}
            >
              {t.text}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  )
}
