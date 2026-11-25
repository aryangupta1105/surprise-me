// Applies pending prisma/migrations at start-up, recording them in Prisma's own _prisma_migrations table.
// Used instead of `prisma migrate deploy` because on Embarko a replication process (Litestream) briefly locks the
// SQLite file, and Prisma's migrate gives up on the first lock; here every statement waits up to 60 s.
import { createHash, randomUUID } from 'node:crypto'
import { mkdirSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { createClient } from '@libsql/client'

const env = process.env
const url = env.DATABASE_URL || (env.DATA_DIR ? `file:${env.DATA_DIR.replace(/\/$/, '')}/surpriseme.db` : 'file:./data/dev.db') // same as src/lib/db-url.ts
mkdirSync(path.dirname(url.slice(5)), { recursive: true })
const db = createClient({ url })
await db.execute('PRAGMA busy_timeout = 60000')

await db.execute(`CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
  "id" TEXT PRIMARY KEY NOT NULL, "checksum" TEXT NOT NULL, "finished_at" DATETIME, "migration_name" TEXT NOT NULL,
  "logs" TEXT, "rolled_back_at" DATETIME, "started_at" DATETIME NOT NULL DEFAULT current_timestamp,
  "applied_steps_count" INTEGER UNSIGNED NOT NULL DEFAULT 0)`)
const { rows } = await db.execute('SELECT migration_name, finished_at FROM _prisma_migrations WHERE rolled_back_at IS NULL')
const unfinished = rows.filter((r) => !r.finished_at).map((r) => r.migration_name)
if (unfinished.length) throw new Error(`Migration(s) left half-applied, fix by hand: ${unfinished.join(', ')}`)
const applied = new Set(rows.map((r) => r.migration_name))

const dir = 'prisma/migrations'
const pending = readdirSync(dir).filter((n) => !applied.has(n) && /^\d/.test(n)).sort()
for (const name of pending) {
  const sql = readFileSync(path.join(dir, name, 'migration.sql'), 'utf8')
  const id = randomUUID()
  await db.execute({ sql: 'INSERT INTO _prisma_migrations (id, checksum, migration_name, started_at) VALUES (?, ?, ?, current_timestamp)', args: [id, createHash('sha256').update(sql).digest('hex'), name] })
  await db.executeMultiple(`BEGIN IMMEDIATE;\n${sql}\nCOMMIT;`)
  await db.execute({ sql: 'UPDATE _prisma_migrations SET finished_at = current_timestamp, applied_steps_count = 1 WHERE id = ?', args: [id] })
  console.log('applied migration', name)
}
console.log(pending.length ? `${pending.length} migration(s) applied` : 'database up to date')
db.close()
