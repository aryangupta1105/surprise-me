import 'server-only'
import { z } from 'zod'
import { databaseUrl } from './db-url'

// Validated once at first import. Server only: nothing here may reach the browser.
const schema = z.object({
  DATABASE_URL: z.string().startsWith('file:'),
  APP_SECRET: z.string().min(32),
  APP_URL: z.string().url(),
  TICK_SECRET: z.string().min(16),
  VIASOCKET_ORG_ID: z.string().min(1),
  VIASOCKET_PROJECT_ID: z.string().min(1),
  // Optional at boot so the studio still works before setup; viaSocket calls fail with a clear message.
  VIASOCKET_EMBED_SECRET: z.string().min(1).optional(),
  // S3-compatible media storage (Backblaze B2, Cloudflare R2, …). All or none: without them media is kept under DATA_DIR/media.
  S3_ENDPOINT: z.string().regex(/^[a-z0-9.-]+$/, 'host only, e.g. s3.us-west-004.backblazeb2.com').optional(),
  S3_REGION: z.string().min(1).optional(),
  S3_BUCKET: z.string().min(1).optional(),
  S3_ACCESS_KEY_ID: z.string().min(1).optional(),
  S3_SECRET_ACCESS_KEY: z.string().min(1).optional(),
  S3_PREFIX: z.string().default(''), // e.g. 'surpriseme/' when the key may only write names starting with it
})

// The build may run without secrets (hosts inject them only at runtime), so validation is skipped there; it runs at start-up.
const raw = { ...process.env, DATABASE_URL: databaseUrl() }
export const env = process.env.NEXT_PHASE === 'phase-production-build' ? (raw as unknown as z.infer<typeof schema>) : schema.parse(raw)
