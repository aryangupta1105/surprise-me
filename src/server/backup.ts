import 'server-only'
import { readFile, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { db } from '@/lib/db'
import { databaseUrl } from '@/lib/db-url'
import { log } from '@/lib/http'
import * as storage from './storage'

// Embarko does not back up DATA_DIR, so once a day the scheduler's tick copies the SQLite database into the
// private media bucket (backups/surpriseme-YYYY-MM-DD.db; one file per day, overwritten within the day).
// ponytail: whole-file copy, fine while the database is a few hundred MB; switch to incremental if it grows.

const dbFile = () => path.resolve(databaseUrl().replace(/^file:/, ''))
const marker = () => `${dbFile()}.last-backup`
const DAY = 86_400_000

export async function backupIfDue(now = Date.now()) {
  if (storage.storageDriver !== 's3') return { skipped: 'no bucket configured' }
  const last = Number(await readFile(marker(), 'utf8').catch(() => '0'))
  if (now - last < DAY) return { skipped: 'done today' }
  const copy = `${dbFile()}.backup`
  await rm(copy, { force: true })
  await db.$executeRawUnsafe(`VACUUM INTO '${copy.replace(/'/g, "''")}'`) // consistent snapshot while the app runs
  try {
    const { size } = await stat(copy)
    const key = `backups/surpriseme-${new Date(now).toISOString().slice(0, 10)}.db`
    const t = storage.uploadTarget(key, 'backup', 'application/octet-stream', size)
    const res = await fetch(t.url, { method: 'PUT', headers: t.headers, body: await readFile(copy) })
    if (!res.ok) throw new Error(`upload failed (${res.status})`)
    await writeFile(marker(), String(now))
    log('info', 'database backed up', { key, size })
    return { key, size }
  } finally {
    await rm(copy, { force: true })
  }
}
