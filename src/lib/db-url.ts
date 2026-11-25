// Where the SQLite file lives. On Embarko, DATA_DIR is the only folder that survives redeploys
// (and it is not backed up). Shared by the app and prisma.config.ts.
export function databaseUrl(env: Record<string, string | undefined> = process.env) {
  if (env.DATABASE_URL) return env.DATABASE_URL
  if (env.DATA_DIR) return `file:${env.DATA_DIR.replace(/\/$/, '')}/surpriseme.db`
  return 'file:./data/dev.db'
}
