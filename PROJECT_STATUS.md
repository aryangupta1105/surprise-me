# SurpriseMe — Project status

_Last updated: 2026-11-25 (Phase 5 templates done; code on github.com/aryangupta1105/surprise-me — see SURPRISEME_AUDIT.md)_

## Summary

The full product is built and runs locally: landing page, guided Surprise Studio, AI generation for all six experiences, editor with live preview and per-section rewrite, publishing with private links, recipient experiences, Gmail delivery (now + scheduled), calendar reminders, guest sessions, account upgrade path, and dashboard.

**Not yet done:** the scheduler's real run needs a public URL, accounts need a 36Blocks block, and nothing is deployed to Embarko.

## Evolution plan progress (SURPRISEME_AUDIT.md)

| Phase | Status |
| --- | --- |
| 1 Audit & plan | Done, approved 2026-11-25 (SQLite on Embarko, R2 for media, versioned documents) |
| 2 Scene/block engine | **Done** — registry (14 block types), document schema, pure ops, legacy converter, `SurpriseVersion` + frozen publishing, one scene player for recipients and preview, resume after refresh, server-side locks. 41/41 tests; browser-checked on old links and the editor |
| 3 Quick Create | **Done** — `/create` = one description box + optional photos → AI brief (editable: names, occasion, tone, 1–3 experiences, memories, own message, palette, photos) → multi-scene draft (opening, photo gallery, one scene per experience, finale with the creator's words verbatim). Guided create kept at `/create/guided`. Document surprises open in a new editor: scenes (add/move/duplicate/delete, kind, transition, colours, lock), blocks (add from the registry, move/duplicate/delete, schema-generated forms), theme, autosave, undo/redo, live preview. 48/48 tests; live AI + browser walkthrough |
| 4 Media library | **Done — on Backblaze B2** (S3-compatible; R2 also works) — photos, audio (upload or record a voice note in the browser, up to 3 min) and video per surprise; browser uploads straight to storage (R2 presigned PUT, or `DATA_DIR/media` without R2), server sniffs the real file type before accepting it; photos shrunk to 2048 px in the browser; library picker to reuse/delete media; new **Song or voice note** and **Video** blocks; video seeking (Range); duplicates share files; cleanup on delete and for abandoned uploads. 55/55 tests; browser-checked upload → editor → published link on mobile |
| 5 Templates | **Done (10 of 15)** — Birthday Celebration, Romantic Love Story, Friendship Scrapbook, Digital Memory Book, Mystery Treasure Hunt, Open When Letters, Interactive Friendship Quiz, Mystery Gift Reveal, Our Soundtrack, Time Capsule. `/templates` gallery (category filter, live preview, combine several in any order); server-side merging (one opening/finale — creator picks which, content kept verbatim, fresh ids, overall theme chosen, template colours kept only where light/dark-compatible, big transitions softened when motion isn't full, 30-scene limit); **Insert a template** in the editor (undo-able); **Still to add** list of empty media slots. 77/77 tests; browser-checked. Magazine Cover, Personality Awards, Journey Map, Countdown and Mini Game need new block types → Phase 9 as planned |
| 6 Studio completion | Next |

## Original build phases

| Phase | Status |
| --- | --- |
| 0 Inspect & plan | Done (viaSocket skill + AI, automations, app-integrations, connect, actions-and-events, test-connection, manage, built-ins, feedback, login-and-orgs, Gmail & Google Calendar pages all read to `END OF PAGE`) |
| 1 Foundation | Done — Next.js 16 (App Router, TS strict), Tailwind 4, Framer Motion, Prisma 7 + SQLite (libsql adapter; was Postgres until 2026-11-25), Zod env validation |
| 2 Landing & design system | Done — tokens in `globals.css`, 6 experience palettes, `components/ui.tsx` (buttons, cards, fields, modal, toasts, empty/error states) |
| 3 Surprise Studio | Done — 5 steps, server draft + local copy, refresh-safe |
| 4 viaSocket AI | Done & tested live (all 6 types) |
| 5 Six experiences | Done — each its own component and interaction model |
| 6 Publishing & links | Done & tested |
| 7 Email & scheduling | Gmail tested live; scheduler flow created, real run pending public URL |
| 8 Calendar | Done & tested live (event created; Google's refusal recorded) |
| 9 Auth & dashboard | Guest sessions + dashboard done & tested; accounts built, need 36Blocks `reference_id` |
| 10 QA | 26 automated tests, live integration scripts, browser walkthrough, lint, build, viaSocket check |
| 11 Deploy (Embarko) | Not started — blocked (see above) |

## Architecture decisions

- **One Next.js app** (route handlers = Node backend). Business logic in `src/server/*`, route handlers in `src/app/api/*` stay thin, all wrapped by `route()` in `src/lib/http.ts` (Zod errors → 400, `AppError`, structured JSON logs, same-origin CSRF check).
- **Guest-first identity:** a guest is a `User` row with `isGuest = true` and an httpOnly session cookie (only its SHA-256 is stored). Signing up flips the same row, so drafts, surprises and viaSocket connections need no migration. Signing in to an existing account from another guest moves that guest's surprises/photos/reminders.
- **Accounts via 36Blocks** (viaSocket's login product, recommended by the skill): it gives email + Google sign-in screens with no password storage. The 36Blocks token is used once to identify the user, then our own session takes over.
- **AI output = data, never code.** Each experience has a strict Zod schema (`src/lib/schemas.ts`), sent as a JSON schema; output is re-validated with Zod before storing; React renders text only (no `dangerouslySetInnerHTML` anywhere). Creator input is wrapped in `<creator_data>` and the prompt says it is data — tested with a planted "IGNORE ALL PREVIOUS INSTRUCTIONS" joke (ignored).
- **AI model choice:** `claude-sonnet-5-5` — valid JSON in 10–16 s with grounded writing. `gpt-6-luna` was valid but took 51 s; `gemini-3.8-flash` returned 502. Anthropic rejects `minItems > 1`, so numeric bounds are stripped from the schema sent to the model and enforced by Zod afterwards. Cost ≈ $0.02–0.04 per generation at list price.
- **Private links:** 192-bit random token; DB stores its SHA-256 (lookup) and an AES-256-GCM ciphertext (so the creator can see/email it again). Revoke, rotate and optional expiry. `/s/*` sends `X-Robots-Tag: noindex` and `robots.txt` disallows it; `Referrer-Policy: no-referrer` site-wide.
- **Scheduled "open when" letters** are stripped server-side until their unlock time (not just hidden in the UI).
- **Email delivery** runs through the creator's own Gmail via viaSocket. Exactly-once: client idempotency key (unique) + atomic `SCHEDULED → SENDING` claim. Failures are recorded and **not** auto-retried (a Gmail call may have sent); the creator retries explicitly. A send that crashes mid-way is marked failed after 10 min with "check your Sent folder".
- **Scheduler:** one viaSocket cron automation (owned by system user `surpriseme-system`) POSTs `/api/cron/tick` every 5 minutes with `CRON_SECRET` (`scripts/setup-scheduler.mts`). No scheduler of our own.
- **Calendar reminder:** the Google Calendar action has no custom-reminder-minutes field (only "use default reminders"), so the reminder is a 15-minute event placed N days before the occasion at the chosen time. The action also always adds a Meet link (documented behaviour) and accepts only 20 time zones.
- **Photos** are stored in Postgres (≤3 MB, type sniffed from magic bytes, ≤12 per surprise) and served only to their owner or through a valid surprise link. `ponytail:` note in the schema: move to object storage if volume grows.
- **Engagement** is counts only (opens, furthest progress, completed time) — no IP, device or recipient identity.
- **Rate limiting** is in-memory per process (`ponytail:` note) — fine for one instance; move to Postgres/Redis for several.
- `cacheComponents` (Next 16 opt-in) is off: every page here is per-user and dynamic.

## Files

- `prisma/schema.prisma`, `prisma/migrations/` — User, Session, Surprise, AIGeneration, Upload, IntegrationConnection, Delivery, CalendarReminder
- `src/lib/` — env, db, crypto, session, http, viasocket client, schemas, catalog, email template
- `src/server/` — ai, surprises, delivery, calendar, integrations, accounts
- `src/app/api/` — 20 route handlers
- `src/app/` — `/` landing, `/create` studio, `/studio/[id]` editor/preview/share, `/s/[token]` recipient, `/dashboard`, `/settings`
- `src/components/` — `ui.tsx`, `Connections.tsx`, `site/*`, `experiences/*` (6 templates + shell)
- `tests/` — Vitest suites; `scripts/` — live integration scripts and scheduler setup
- `viasocket-plan.md`, `.env.example`

## Tests executed (2026-11-25)

| Check | Result |
| --- | --- |
| `npx vitest run` (unit + DB: answer matching, reminder dates, schema stripping, malformed/truncated/non-JSON AI output, retry & no-retry on refusal, concurrent generation lock, section rewrite, publish/rotate/revoke/expiry, archived links, engagement only forward, duplicate, cascade delete, guest session, guest→account upgrade and merge, locked letters hidden, email HTML escaping) | **26/26 pass** |
| `npx tsc --noEmit` | pass |
| `npx eslint src tests` | clean |
| `npx next build` | pass |
| `npx -y viasocket-apps check src` | **0 FAIL, 0 WARN** (4 PASS: gmail / google-calendar slugs and both action_ids) |
| Browser walkthrough (guest): studio → refresh keeps draft → generate → edit → rewrite section → publish → recipient on mobile (wrong + right answers) → engagement → revoke → "not available" | pass |
| Browser: gift reveal, open-when (letter opens; envelope overlap bug found and fixed), cards flip, dashboard | pass |
| curl: no session 401; other guest 404 on GET/DELETE/publish/studio page; cross-site POST 403; bad input 400; non-image upload 415; cron without secret 401 | pass |
| `scripts/test-all-experiences.mts` (live AI, all 6 types via the app's own `generateExperience`) | 6/6 PASS |
| `scripts/integration-email.mts` (live Gmail via app code, sent only to the test account itself) | 9/9 PASS |
| `scripts/integration-calendar.mts` (live Google Calendar via app code) | 3/3 PASS — found and fixed a bug: impossible dates (2026-13-45, 2026-02-30) crashed the reminder route with a 500; now a 400 "Not a real date" |

## Integration test record

Moved to [INTEGRATION_TESTS.md](INTEGRATION_TESTS.md).

## Known issues / notes

- Vitest 5 fails a test when a `vi.fn` itself throws; the "refusal" test raises the error inside the AI client call path instead (same code path in `generateExperience`).
- Signing in to an existing account from a *different* guest moves surprises, but that guest's app connections stay on the guest id (viaSocket connections can't be re-owned); the user reconnects Gmail/Calendar once.
- The signing secret was pasted into chat on 2026-11-25; viaSocket's guidance is to replace it (embed project → Settings → Signing secret → Replace) and update `.env`.
- Rate limits are per process.

## Outstanding / next

1. Create a 36Blocks block (redirect URL `<APP_URL>/api/auth/callback`) and set `NEXT_PUBLIC_BLOCKS_REFERENCE_ID`.
2. Deploy to Embarko, set env vars there, run `prisma migrate deploy`, then `scripts/setup-scheduler.mts` with the public `APP_URL` and watch one tick in `runHistory`.
