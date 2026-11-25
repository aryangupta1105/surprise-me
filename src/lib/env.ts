import 'server-only'
import { z } from 'zod'

// Validated once at first import. Server only: nothing here may reach the browser.
const schema = z.object({
  DATABASE_URL: z.string().url(),
  APP_SECRET: z.string().min(32),
  APP_URL: z.string().url(),
  CRON_SECRET: z.string().min(16),
  VIASOCKET_ORG_ID: z.string().min(1),
  VIASOCKET_PROJECT_ID: z.string().min(1),
  // Optional at boot so the studio still works before setup; viaSocket calls fail with a clear message.
  VIASOCKET_EMBED_SECRET: z.string().min(1).optional(),
})

export const env = schema.parse(process.env)
