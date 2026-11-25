'use client'

// Contract between the player and interactive blocks (the original six experience components).
export type ExpProps<T> = {
  content: T
  photo: (id?: string) => string | null
  onProgress: (fraction: number) => void
  onDone: () => void
  celebrate: () => void
}

export const Progress = ({ value, total }: { value: number; total: number }) => (
  <div className="flex gap-1.5 justify-center" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={value} aria-label="Progress">
    {Array.from({ length: total }, (_, i) => (
      <span key={i} className="h-1.5 rounded-full transition-all duration-500" style={{ width: i === value ? 28 : 12, background: 'var(--p-accent)', opacity: i <= value ? 1 : 0.25 }} />
    ))}
  </div>
)
