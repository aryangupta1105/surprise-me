# SurpriseMe

Make someone's day unforgettable: create a personal, interactive digital surprise (treasure hunt, memory journey, quiz, gift reveal, cards, open-when letters) and share it with a private link or by email.

## Run locally

```bash
npm install
cp .env.example .env          # then fill it (viaSocket keys: npx -y viasocket-apps setup --no-open)
npx prisma migrate deploy        # creates ./data/dev.db (SQLite)
npm run dev -- -p 3100
```

## Checks

```bash
npm test                      # Vitest (throwaway ./data/test.db)
npm run typecheck && npm run lint && npm run build
npx -y viasocket-apps check src
node --env-file=.env --conditions=react-server --import tsx scripts/test-all-experiences.mts   # live AI
node --env-file=.env --conditions=react-server --import tsx scripts/integration-email.mts      # live Gmail (test account only)
```

Status, decisions and the integration test record: [PROJECT_STATUS.md](PROJECT_STATUS.md). viaSocket wiring: [viasocket-plan.md](viasocket-plan.md).

## Media storage (Backblaze B2, or any S3-compatible bucket)

Without the `S3_*` variables, media is stored under `DATA_DIR/media` (fine locally; not backed up on Embarko). We use Backblaze B2 (10 GB free):

1. backblaze.com → B2 Cloud Storage → **Create a Bucket**, files **Private**.
2. **Application Keys → Add a New Application Key**: read and write, limited to that bucket. If you set "file name prefix", put the same value in `S3_PREFIX`.
3. Put the values in `.env` yourself (never in chat or git): `S3_ENDPOINT` (the bucket's "Endpoint", e.g. `s3.us-west-004.backblazeb2.com`), `S3_REGION` (`us-west-004`), `S3_BUCKET`, `S3_PREFIX`, `S3_ACCESS_KEY_ID` (keyID), `S3_SECRET_ACCESS_KEY` (applicationKey). Restart the dev server.
4. CORS: the B2 website can only allow downloads, so the upload rule is set through the B2 API (`b2_update_bucket`): an S3 rule allowing `s3_head`, `s3_get`, `s3_put` with headers `content-type`, `range` from each app origin. **Add the deployed URL to it before going live.**
5. Check: `node --env-file=.env --conditions=react-server --import tsx scripts/integration-storage.mts`. Media uploaded before switching: `scripts/copy-local-media-to-s3.mts`.

Cloudflare R2 works the same way (`S3_ENDPOINT=<account>.r2.cloudflarestorage.com`, `S3_REGION=auto`).

## viaSocket

The viaSocket installation pointer is at `viasocket-integrations/SKILL.md`. Fetch and follow the current full skill each time viaSocket work is performed. Keys live in `.env` only; the embed secret is server-side and never committed, logged or sent to the browser.
