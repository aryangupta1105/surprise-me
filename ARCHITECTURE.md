# Architecture

## Layers

| Layer | Where | Rule |
| --- | --- | --- |
| Pages / UI | `src/app/*`, `src/components/*` | client components only where interactive |
| Route handlers | `src/app/api/*` | thin; wrapped by `route()` (`src/lib/http.ts`): Zod 400s, `AppError`, JSON logs, same-origin check |
| Business logic | `src/server/*` | ownership checked here, never by URL |
| Scene engine | `src/engine/*` | isomorphic (server + browser), pure, no I/O |
| Shared | `src/lib/*` | env, db, crypto, session, viaSocket client, schemas |

## Scene engine (`src/engine`)

A surprise is a **document**: `{ version: 1, theme, scenes: Scene[] }`, each scene `{ id, kind, title, palette?, transition, unlockAt?, blocks: Block[] }`, each block `{ id, type, props }`.

- `blocks.ts` — the **block registry**: every type with its Zod `schema`, label, category and `create()` defaults. Server-safe.
- `doc.ts` — document schema; `SurpriseDoc` validates every block's props against the registry and rejects unknown types and duplicate ids. `parseDoc` applies defaults.
- `ops.ts` — **pure operations** (add/remove/duplicate/move scene and block, update props/scene, set theme). Each returns a new, re-validated document. The editor, the AI assistant and templates change documents only through these.
- `convert.ts` — legacy single-experience content → opening / experience / finale document.
- `player/Player.tsx` — plays any document: one scene at a time, transitions (fade, slide, zoom, flip, none), progress bar, back, resume from `localStorage`, interactive blocks advance on completion, locked-scene card.
- `player/renderers.tsx` — one trusted React renderer per block type. Text is rendered as text; there is no HTML block.

**Adding a block type:** add an entry to `BLOCKS` and a renderer to `RENDERERS` (TypeScript fails the build if either is missing). Nothing else changes.

Block types today: heading, paragraph, handwritten, quote, letter, image, gallery (grid/polaroid/slideshow), treasure_hunt, timeline, quiz, gift_reveal, cards, open_when, confetti.

## Creation flows

- **Quick Create** (`/create`, `src/server/quick.ts`): `extractBrief` (one AI call, strict `Brief` schema, the description is data) → the creator corrects the brief → `/api/quick/start` creates the draft → photos upload to it → `composeDraft` writes each chosen experience in parallel with `writeExperience` (retry once on malformed output, never on a refusal) and `assembleDoc` builds opening / photos / experiences / finale. The creator's own message is used verbatim.
- **Guided Create** (`/create/guided`): the original five steps; produces legacy single-experience content, converted to a document when published.

## Editing

- Document surprises (`draftVersionId` set) open in `DocStudio`: every change goes through `src/engine/ops.ts`; invalid results are refused with a message. Autosave 1.5 s after the last change (`PUT /api/surprises/[id]/doc` → new `SurpriseVersion`, last 30 drafts kept). Undo/redo in memory (50 steps).
- `src/components/BlockForm.tsx` renders a form from any block's Zod schema (via JSON Schema): strings, long text, enums, numbers, booleans, date-times, photo pickers, nested objects and lists with add/remove/reorder within the schema's bounds. New block types need no editor code.
- Legacy single-experience surprises keep the original editor until migrated.

## Versions and publishing

- `SurpriseVersion` rows hold immutable document snapshots. **Publishing** creates one and points `Surprise.publishedVersionId` at it; recipients only ever see that snapshot. "Publish changes" makes a new snapshot and keeps the link.
- Surprises published before versions existed are converted on the fly; their first edit freezes what recipients saw as a `legacy` version.
- Time-locked content (scene `unlockAt`, open-when letter `unlockAt`) is removed on the server before the document reaches the recipient.
- Phase 2 note: the creator still edits the legacy single-experience content; Phase 6 (Studio) edits documents directly and adds autosave/undo on `SurpriseVersion`.

## Media (`src/server/media.ts`, `storage.ts`, `sigv4.ts`)

1. `POST /api/uploads` `{surpriseId, kind, mime, size}` checks ownership, limits and counts, and creates a `pending` row. It returns an upload target: an S3 presigned PUT (Backblaze B2 in use) (15 min, Content-Type and Content-Length signed) or `/api/uploads/:id/blob` locally.
2. The browser PUTs the file there (`src/lib/upload-client.ts`; photos are resized first).
3. `POST /api/uploads/:id/complete` reads the first 32 bytes back from storage and sniffs the real type. A mismatch deletes it; otherwise the row becomes `ready`.
- **Serving:** creators use `/api/uploads/:id`; recipients use `/api/s/:token/photo/:id` (published surprise only). With S3 storage this is a 302 to a 1-hour signed GET; locally the file is streamed with Range support.
- **Signing:** SigV4 presigning is implemented in ~30 lines (`sigv4.ts`, tested against AWS's published example) instead of adding the AWS SDK.

## Templates (`src/templates/library.ts`, `src/engine/compose.ts`)

Templates are typed data: scenes with `{to}`/`{from}` placeholders and empty media slots. `composeTemplates(ids, options)` and `insertTemplate(doc, id, at, names)` are pure and validated with `parseDoc`; the API runs them on the server (`src/server/templates.ts`) and saves template drafts as `SurpriseVersion` with `source: 'template'`. The browser uses the same functions only for previews and the summary line. `missingMedia(doc)` lists empty slots for the editor.

## Hosting constraints (Embarko)

SQLite under `DATA_DIR` (not backed up), one process with 256 MB memory, no WebSockets, public-only file store. Consequences: media processing in the browser, private media in an S3-compatible bucket (Backblaze B2; falls back to `DATA_DIR/media`), the scheduler stays a viaSocket cron flow, and our tick secret must not be named `CRON_SECRET` (rename before deploy).
