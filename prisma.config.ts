import 'dotenv/config'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { defineConfig } from 'prisma/config'
import { databaseUrl } from './src/lib/db-url'

const url = databaseUrl()
if (url.startsWith('file:')) mkdirSync(dirname(url.slice(5)), { recursive: true })

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url },
})
