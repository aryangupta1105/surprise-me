# SurpriseMe — Audit & evolution plan

_Phase 1 of the "Product Evolution" brief · 2026-11-25 · status: **approved 2026-11-25**_

**Decisions (2026-11-25):** D1 **SQLite on Embarko** (your call, changed from external Postgres the same day; file under `DATA_DIR`, not backed up by Embarko — export/backup to be added) · D2 Cloudflare R2 with signed URLs (10 GB/month free, free egress; whether R2 asks for a payment method is unconfirmed — fallback: Embarko store + encryption) · D3 versioned JSON document, templates in code · D4 plan approved, Phase 2 started. viaSocket stays on org 79213 / project projeQn5v4I8.

Everything below was checked against the code, the database and live calls today, not taken from earlier docs.

---

## 1. What exists today

**Stack:** Next.js 16.4 (App Router, route handlers as the Node backend), React 19, TypeScript strict, Tailwind 4, Framer Motion 14, Prisma 7 + PostgreSQL (driver adapter `@prisma/adapter-pg`), Zod 4, `viasocket-apps` 0.21, Vitest 5. ~5,000 lines of our own code, 10 runtime dependencies.

**Layering** (sound, keep it):

| Layer | Where | Notes |
| --- | --- | --- |
| Pages / UI | `src/app/*`, `src/components/*` | client components only where interactive |
| Route handlers | `src/app/api/*` (20) | thin; all wrapped by `route()` → Zod 400s, `AppError`, JSON logs, same-origin CSRF check |
| Business logic | `src/server/*` | `ai`, `surprises`, `delivery`, `calendar`, `integrations`, `accounts` |
| Shared | `src/lib/*` | env (Zod-validated), db, crypto, session, http, viasocket client, schemas, email template |

**Database** (`prisma/schema.prisma`, 1 migration): `User` (guest = `isGuest` row), `Session` (hashed cookie token), `Surprise` (studio input JSON + **one** experience JSON + theme + link hash/ciphertext + engagement counters), `AIGeneration`, `Upload` (**image bytes stored in Postgres**), `IntegrationConnection`, `Delivery`, `CalendarReminder`. Live dev data: 7 users, 11 surprises, 0 uploads, 1 failed delivery (yours, awaiting Retry), 1 reminder.

**viaSocket:** org `79213`, project `projeQn5v4I8` (kept as you confirmed; the brief's `88476/projvakuUqrB` is out of date). Embed secret in `.env` only.

## 2. Working features (verified)

| Feature | Evidence |
| --- | --- |
| Landing page, 5-step guided studio, refresh-safe drafts | browser walkthrough |
| AI generation for 6 experience types (strict JSON schema → Zod) | live: 6/6 valid, 10–16 s, `claude-sonnet-5-5` |
| Per-item rewrite with a note | live, 8 s |
| Editor with live preview, palettes, motion levels, photo upload (memory journey, gift) | browser |
| Publish, private link (192-bit, hashed + encrypted), rotate, revoke, expiry, noindex | Vitest + browser + curl |
| Recipient experiences: treasure hunt, memory journey, quiz, gift reveal, cards, open-when (locked letters stripped server-side) | browser on mobile size |
| Engagement (opens, furthest progress, completed) — no personal data | Vitest + browser |
| Gmail send now / scheduled / idempotent / exactly-once / failure recorded | live 9/9 + your account after Reconnect |
| Google Calendar reminder | live 3/3 + from your Settings |
| In-app viaSocket Connect (Gmail, Calendar) + Reconnect | you, today |
| Guest sessions, ownership checks, guest → account upgrade logic | Vitest (36Blocks mocked) |
| Dashboard: filters, duplicate, archive, revoke, delete, engagement | browser |

## 3. Incomplete or broken

| Item | State |
| --- | --- |
| Accounts (36Blocks) | code done, **off** — needs a block `reference_id` from you |
| Scheduler (viaSocket cron → `/api/cron/tick`) | flow created, **paused**; first real run needs a public URL |
| Gmail permissions | viaSocket's `Send_Email` under-declares scopes; workaround = full Gmail consent. Reported `row0904nyxej` |
| One surprise = one experience type | the core limitation this brief fixes |
| Media | images only, ≤3 MB, stored as bytes in Postgres; no audio, video, recording, library, reuse |
| Music, voice, video, scrapbook, collage, games beyond the 6 | none |
| Template system, merging, Studio canvas, undo/redo, conversational AI editor | none |
| Collaboration, reactions, password lock, time capsule, keepsake export | none |
| Audit events, retention job | none |
| Reference site (birthday-wisher-zeta.vercel.app) | not inspected — it renders only with JavaScript and Claude in Chrome blocks it ("could not verify this site's safety category") |
| Deployment | none |

## 4. Technical debt / risks found in the current code

1. **`CRON_SECRET` clashes with Embarko**, which reserves that variable name (409 `env_var_conflict`). Rename ours to `TICK_SECRET` before deploy.
2. **Media bytes in the database** — must move to object storage (brief requirement, and Embarko memory limits).
3. **Content model is one experience per surprise** (`Surprise.content` discriminated union). Everything else in the brief builds on replacing this.
4. Rate limiting is in-memory per process — fine on Embarko (one process), noted.
5. `Experience.tsx` + six experience components duplicate shell logic (intro, progress, closing) that a scene engine would own once.
6. Signing secret was pasted in chat earlier — rotate before deploy.

## 5. Hosting facts that shape the plan (Embarko docs, read today)

| Embarko | Consequence |
| --- | --- |
| **No managed database.** Records go in SQLite under `DATA_DIR`; **no backups**. Startup schema diffing is refused; committed migrations are fine | Either move to SQLite or keep Postgres on an external host — **decision D1** |
| **File store: every file is public to anyone with the link** (unguessable, not listed), plan quota (e.g. 500 MB), per-file max (e.g. 25 MB), allowed types include jpg/png/webp/gif/mp3/wav/ogg/mp4/webm, **not** m4a/mov | Conflicts with "private storage, signed URLs" — **decision D2** |
| **256 MB memory per app, one process, no WebSockets** | No server-side video/image processing: thumbnails, resizing, trimming happen in the browser (canvas, MediaRecorder, Web Audio). AI uses sync/stream replies, not websockets |
| Schedules via `embarko.json` (sets `CRON_SECRET`) | We keep viaSocket's cron flow (your rule: viaSocket for scheduling) |

## 6. Proposed architecture

### 6.1 The surprise document (scene/block engine)

A surprise becomes a **document**: an ordered list of **scenes**, each with ordered **blocks**. One Zod schema per block type, assembled by a **registry**; the recipient player and the editor render only registered types with trusted React components. AI, templates and the editor all change the document through the **same pure operations** (`ops.ts`), so every change is validated the same way and undo/redo is just history of documents.

```ts
SurpriseDoc = { version: 1, theme: Theme, soundtrack?: AudioRef, scenes: Scene[] }
Scene      = { id, kind: 'opening'|'content'|'game'|'media'|'finale', title, background, transition, unlockAt?, music?, blocks: Block[] }
Block      = { id, type: <registered>, props: <that type's schema>, style?, visibility? }
```

**Recommended storage (deviation from the brief, flagged — decision D3):** keep scenes/blocks as one validated JSON document per **version**, not as relational `Scene`/`SceneBlock` rows.
- `SurpriseVersion { id, surpriseId, doc Json, createdAt, source: 'autosave'|'ai'|'template'|'manual' }` — autosave = new version (pruned to last 50), undo/redo = move a pointer, AI edits are a proposed version you accept.
- `Surprise.publishedVersionId` — **recipients see a frozen published snapshot**, so editing never breaks a live link.
- Why: reorder/duplicate/merge/AI patches touch many scenes at once; as rows that is many writes and hard-to-undo state; as a document it is one validated write. Relational tables stay for things with their own lifecycle and access rules (media, templates you save, contributions, reactions, deliveries).

**Block catalog, first release (~24 types), each a folder `src/engine/blocks/<type>/{schema,Render,Editor}`:**
heading, paragraph, handwritten, quote, letter · image, gallery, polaroids, collage, slideshow, image-reveal · voice-message, music-player, audio-with-transcript · video · quiz, treasure-clue, scratch-reveal, countdown, locked-message, gift-reveal, memory-match, open-when · stickers, confetti/floating decor · layouts: two-column, card-grid, timeline, carousel.
The six existing experiences are reused as the interactive blocks (no rewrite of their visuals). Remaining catalog items (rich text, playlists, video montage, GIF search, journey map…) are added later by registering new folders — the engine does not change.

### 6.2 Templates and merging

- Templates are typed TypeScript data in the repo (`src/templates/*`), each = metadata + theme + scenes with placeholder slots + required media. 15 families per the brief, delivered across phases (6 converted from today's experiences in Phase 5, rest after).
- **`composeTemplates(base, additions[], options)`** on the server: keeps one opening and one finale (the base's unless you choose), concatenates content scenes preserving each template's content, re-ids everything, resolves themes (your chosen overall theme wins; scene-level theme overrides kept only where compatible), keeps transitions, lists missing media slots, validates the result. Also `insertTemplate(doc, template, atIndex)`. Unit-tested.
- DB `Template` / `TemplateVersion` tables only when users can save their own templates (later phase) — **decision D3** covers this too.

### 6.3 Media library

- `MediaAsset { id, ownerId, kind: image|audio|video|gif, storageKey, mime, bytes, width, height, durationMs, thumbKey, title, caption, altText, transcript, status: uploading|ready|failed, createdAt, deletedAt }` + `MediaUsage` derived from documents for "used in N scenes".
- Uploads: browser validates and **resizes images / grabs a video poster frame / records voice (MediaRecorder)** → server issues an upload slot → bytes go to storage → server verifies magic bytes and size, marks `ready`. Server never decodes large media.
- Trimming: audio and video **play-range trimming** (start/end stored, no re-encode). Real re-encoding is out of reach at 256 MB.
- Transcription (optional, per clip): viaSocket AI with the audio as an attachment (Gemini model, as the AI doc requires) — test before wiring. Photo captions use only the creator's own description unless they tick "let AI look at this photo".
- Storage behind one small adapter (`local` for dev, then the provider from **decision D2**).

### 6.4 Creation modes

- **Quick Create** (new default `/create`): one text box + optional media drop → `ai.extract` (strict schema: occasion, recipient, relationship, tone, interests, memories, desired experiences, media needs, theme) shown as editable chips → `ai.compose` picks templates + fills scenes → studio with the draft. Target: first preview in under 60 s.
- **Guided Create**: today's 5-step studio, kept, plus a media step and a template choice; output becomes a document instead of one experience.
- **Studio** (`/studio/[id]`): scene sidebar (drag to reorder, duplicate, delete, add), block list per scene with inspector panel, media picker, theme/music panel, desktop + phone preview, undo/redo, autosave (debounced, versioned). AI assistant panel: you type an instruction → AI returns **operations** from a fixed vocabulary (`add_scene`, `update_block`, `move_scene`, `set_theme`, …), validated, shown as a diff, applied on Accept, undoable.

### 6.5 Recipient player

One player for every surprise: scene-by-scene with transitions, next/previous where allowed, restart, persistent music bar (tap to start — no sound autoplay), full-screen media, progress saved in `localStorage` so a refresh resumes, per-scene unlock times enforced server-side (locked scenes are sent without content, as letters are today), completion screen, optional reaction.

### 6.6 Later phases (architecture ready, built after the core)

- **Contributions:** `ContributionInvite` (token hash, expiry, closed flag) + `Contribution` (media/text, optional name, status pending/approved/removed). Contributors see only an upload page; approved items land in the media library.
- **Reactions:** `Reaction { surpriseId, emoji, message?, createdAt }`, rate-limited, no identity.
- **Password lock:** argon2/scrypt hash on `Surprise`; unlock sets a short-lived signed cookie.
- **Time capsule / progressive reveals:** scene `unlockAt` (already enforced server-side).
- **Keepsake:** browser-side collage/PDF print view.
- **AuditEvent** for publish, revoke, delete, send, connection changes; **retention** job (delete archived > N days, orphaned media) on the existing tick.

### 6.7 Folder structure (additions)

```
src/engine/            doc schema, ops (pure), history, registry, compose
src/engine/blocks/<type>/{schema.ts, Render.tsx, Editor.tsx}
src/engine/player/     recipient player, transitions, music bar
src/templates/         15 template definitions + index
src/server/media.ts    upload slots, verification, deletion
src/server/storage/    adapter: local | <D2 provider>
src/server/ai/         extract, compose, scene, assistant (split from ai.ts)
src/app/create/        quick (default), guided/
src/app/studio/[id]/   scene editor
src/app/media/         media library
src/app/templates/     gallery
```

### 6.8 Migration of existing data

Non-destructive: add new tables/columns, write a converter that turns each existing `Surprise.content` into a one-or-two-scene document (opening + the experience block + finale) as its first `SurpriseVersion`; the old `content` column is kept read-only until you approve dropping it. Existing links keep working (published version created from current content). Upload bytes copied to storage, then the `Upload` table retired in a later, separately approved migration.

## 7. Development sequence

| Phase | Deliverable | Tested by |
| --- | --- | --- |
| 2 | Document schema + ops + registry with the existing 6 experiences as blocks; converter; player renders documents | Vitest ops/compose, existing links still open |
| 3 | Quick Create (extract → compose → draft), Guided updated | live AI tests, browser |
| 4 | Media library: storage adapter, images (multi, crop, captions), audio upload + recording, video upload + poster, deletion | Vitest + browser on phone size |
| 5 | Templates (first 8) + insertion + merging + theme resolution | Vitest compose cases, browser |
| 6 | Studio: scene sidebar, inspector, media picker, music, undo/redo, autosave, phone preview | browser |
| 7 | AI assistant (operations + diff + undo), regeneration per scene/block, transcription | live AI + malformed-output tests |
| 8 | Player polish: transitions, music bar, galleries, games, final reveal, resume | browser, mobile |
| 9 | Contributions, reactions, password, time capsule, remaining 7 templates | Vitest + browser |
| 10 | Security review, accessibility, performance (256 MB check), migrations, deploy to Embarko | checklist below |

Each phase ends with tests, `PROJECT_STATUS.md`, `CHANGELOG.md` and the relevant doc (`ARCHITECTURE.md`, `DATABASE_DESIGN.md`, `INTEGRATION_TESTS.md`) updated.

## 8. Decisions needed before Phase 2

| # | Decision | Options | Recommendation |
| --- | --- | --- | --- |
| D1 | Database in production | (a) keep **Postgres** on an external managed host (e.g. Neon) — needs an account + a `DATABASE_URL`; backed up; no code change · (b) **SQLite on Embarko** — native, but **no backups** of people's memories; schema/migrations need porting | (a) |
| D2 | Private media storage | (a) **S3-compatible bucket** (e.g. Cloudflare R2) with signed upload/download URLs — truly private, direct browser uploads; new provider + keys · (b) **Embarko file store + encryption**: app encrypts before storing and decrypts when serving to an authorised viewer — private, no new provider, but every view streams through the 256 MB app and video seeking needs chunked encryption · (c) Embarko file store as-is — **public-by-link**, simplest, does not meet the brief | (a); (b) if you want no new provider |
| D3 | Scenes/blocks storage | versioned **JSON document** (recommended, §6.1) vs relational `Scene`/`SceneBlock` rows as the brief lists; templates as code first, DB tables when users save their own | document + code templates |
| D4 | Approval of this plan & sequence | — | — |

## 9. Risks & dependencies

- **256 MB memory:** Next.js server alone uses a good share; must be measured with a production build before relying on Embarko. Mitigation: no server-side media processing, streaming uploads.
- **viaSocket AI**: compose/extract/assistant calls need testing per schema (Anthropic's structured output rejects some JSON-schema keywords — already handled by stripping bounds). Gemini needed for audio transcription — untested.
- **Gmail scope bug** in viaSocket (pending their fix).
- **Browser APIs:** MediaRecorder output differs (Chrome webm/opus, Safari mp4/aac) — Embarko accepts webm/mp4/ogg but not m4a; store with an allowed extension.
- **Licensed music:** no catalog is configured; "select properly licensed tracks" needs a source with clear embed/redistribution rights. Until chosen: user uploads only, plus official embeds (e.g. Spotify/YouTube embed players) where their terms allow, with a fallback card.
- **Scope:** the brief is several weeks of work; each phase is shippable on its own.
