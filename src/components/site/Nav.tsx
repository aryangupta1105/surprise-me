import Link from 'next/link'

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 font-display text-xl font-semibold tracking-tight">
      <span className="grid place-items-center size-9 rounded-2xl bg-rose text-white text-lg -rotate-6 shadow-[0_6px_16px_-6px_rgb(226_85_122/0.8)]" aria-hidden>🎁</span>
      SurpriseMe
    </Link>
  )
}

export function Nav({ minimal }: { minimal?: boolean }) {
  return (
    <header className="relative z-20 mx-auto w-full max-w-6xl px-5 py-5 flex items-center justify-between">
      <Logo />
      {!minimal && (
        <nav className="flex items-center gap-1 sm:gap-3 text-sm font-semibold">
          <Link href="/dashboard" className="px-3 py-2 rounded-full hover:bg-ink/5">My surprises</Link>
          <Link href="/settings" className="hidden sm:block px-3 py-2 rounded-full hover:bg-ink/5">Settings</Link>
          <Link href="/create" className="px-4 py-2 rounded-full bg-ink text-white hover:bg-ink/85">Create</Link>
        </nav>
      )}
    </header>
  )
}
