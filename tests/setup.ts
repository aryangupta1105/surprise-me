import { execSync } from 'node:child_process'
import { vi } from 'vitest'

// Tests run against a throwaway SQLite file, recreated from the committed migrations on every run.
import { rmSync } from 'node:fs'
process.env.DATABASE_URL = 'file:./data/test.db'
process.env.APP_SECRET ??= 'test-secret-test-secret-test-secret-0000'
process.env.APP_URL = 'http://localhost:3100'
process.env.CRON_SECRET ??= 'cron-secret-for-tests'
process.env.VIASOCKET_ORG_ID ??= 'org'
process.env.VIASOCKET_PROJECT_ID ??= 'proj'
process.env.VIASOCKET_EMBED_SECRET ??= 'secret'
const g = globalThis as { __migrated?: boolean }
if (!g.__migrated) {
  for (const f of ['data/test.db', 'data/test.db-journal', 'data/test.db-wal', 'data/test.db-shm']) rmSync(f, { force: true })
  execSync('npx prisma migrate deploy', { env: process.env, stdio: 'ignore' })
  g.__migrated = true
}

// next/headers cookies() outside a request: a simple in-memory jar the tests can inspect.
export const jar = new Map<string, string>()
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (k: string) => (jar.has(k) ? { value: jar.get(k) } : undefined),
    set: (k: string, v: string) => void jar.set(k, v),
    delete: (k: string) => void jar.delete(k),
  }),
}))
