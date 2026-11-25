import { execSync } from 'node:child_process'
import { vi } from 'vitest'

// Tests run against a separate local database, migrated fresh.
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? 'postgresql://aryangupta@localhost:5432/surpriseme_test'
process.env.APP_SECRET ??= 'test-secret-test-secret-test-secret-0000'
process.env.APP_URL = 'http://localhost:3100'
process.env.CRON_SECRET ??= 'cron-secret-for-tests'
process.env.VIASOCKET_ORG_ID ??= 'org'
process.env.VIASOCKET_PROJECT_ID ??= 'proj'
process.env.VIASOCKET_EMBED_SECRET ??= 'secret'
const g = globalThis as { __migrated?: boolean }
if (!g.__migrated) {
  execSync('npx prisma migrate deploy', { env: process.env, stdio: 'ignore' })
  // Only ever the dedicated test database.
  if (!process.env.DATABASE_URL!.endsWith('_test')) throw new Error('Refusing to clean a non-test database')
  execSync(`psql "${process.env.DATABASE_URL}" -qc 'TRUNCATE "User","Session","Surprise","AIGeneration","Upload","IntegrationConnection","Delivery","CalendarReminder" CASCADE'`, { stdio: 'ignore' })
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
