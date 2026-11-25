// One-off: copy media stored under DATA_DIR/media into the S3 bucket after turning S3_* on. Safe to re-run.
// node --env-file=.env --conditions=react-server --import tsx scripts/copy-local-media-to-s3.mts
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { db } from '../src/lib/db.ts'
import * as storage from '../src/server/storage.ts'

if (storage.storageDriver !== 's3') throw new Error('Set the S3_* variables first.')
const dir = path.resolve(process.env.DATA_DIR ?? './data', 'media', 'media')
for (const name of await readdir(dir)) {
  const key = `media/${name}`
  const row = await db.upload.findFirst({ where: { storageKey: key } })
  if (!row) { console.log('skip (no row)', key); continue }
  if (await storage.head(key)) { console.log('already there', key); continue }
  const bytes = await readFile(path.join(dir, name))
  const t = storage.uploadTarget(key, row.id, row.mime, bytes.length)
  const res = await fetch(t.url, { method: 'PUT', headers: t.headers, body: bytes })
  console.log(res.ok ? 'copied' : `FAILED ${res.status}`, key, row.kind, bytes.length)
}
