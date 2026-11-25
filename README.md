# SurpriseMe

Make someone's day unforgettable: create a personal, interactive digital surprise (treasure hunt, memory journey, quiz, gift reveal, cards, open-when letters) and share it with a private link or by email.

## Run locally

```bash
npm install
cp .env.example .env          # then fill it (viaSocket keys: npx -y viasocket-apps setup --no-open)
createdb surpriseme && npx prisma migrate deploy
npm run dev -- -p 3100
```

## Checks

```bash
npm test                      # Vitest (uses database surpriseme_test)
npm run typecheck && npm run lint && npm run build
npx -y viasocket-apps check src
node --env-file=.env --conditions=react-server --import tsx scripts/test-all-experiences.mts   # live AI
node --env-file=.env --conditions=react-server --import tsx scripts/integration-email.mts      # live Gmail (test account only)
```

Status, decisions and the integration test record: [PROJECT_STATUS.md](PROJECT_STATUS.md). viaSocket wiring: [viasocket-plan.md](viasocket-plan.md).

## viaSocket

The viaSocket installation pointer is at `viasocket-integrations/SKILL.md`. Fetch and follow the current full skill each time viaSocket work is performed. Keys live in `.env` only; the embed secret is server-side and never committed, logged or sent to the browser.
