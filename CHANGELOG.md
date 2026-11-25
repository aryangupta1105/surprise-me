# Changelog

## 2026-11-25 — Media storage on Backblaze B2
- Storage settings are now general `S3_*` variables (endpoint, region, bucket, optional name prefix, keys), so B2, R2 or any S3-compatible bucket works. In use: Backblaze B2 bucket `surpriseme` (private), keys limited to names starting `surpriseme/`.
- Bucket CORS updated (with the owner's OK) to allow browser uploads from `http://localhost:3100` only.
- New `scripts/integration-storage.mts` (live check) and `scripts/copy-local-media-to-s3.mts` (moves media stored on disk into the bucket); the 4 earlier test files were copied.

## 2026-11-25 — Phase 4: media library
- Photos, audio and video for each surprise. The browser uploads straight to storage: an S3-compatible bucket (now Backblaze B2) through a short-lived presigned URL when `S3_*` is set, otherwise `DATA_DIR/media`. The server then checks the file's real type from its first bytes before it is usable.
- Photos are resized in the browser (2048 px long edge; HEIC → JPEG), so 30 MB phone photos upload in seconds. Limits: photos 10 MB / 40 per surprise, audio 20 MB / 10, video 80 MB / 5.
- Voice notes recorded in the browser (up to 3 minutes). Microphone allowed for our own pages only.
- New blocks: **Song or voice note** and **Video**. Every photo/audio/video field gets Upload, Record (audio) and **Library** (reuse or delete anything already uploaded to this surprise).
- Recipients' media goes through the private link; video seeking works (Range requests); with R2 the app redirects to a 1-hour signed URL.
- Duplicating a surprise now copies its media and its current document (previously the copy lost its photos and scenes). Deleting a surprise or account deletes its stored files; uploads never completed are cleared after a day.
- Migration `*_media_library` is additive (existing photos stay in the database and keep working).
- Fix found while testing: large PNGs were not resized.

## 2026-11-25 — Phase 3: Quick Create
- `/create` is now Quick Create: describe the surprise in your own words, optionally add photos, review what the AI understood (nothing invented; missing names asked for), then get a multi-scene first draft in ~20–40 s. Guided create moved to `/create/guided`.
- New AI step `extractBrief` (strict schema, description treated as data) and `composeDraft` (experiences written in parallel through the shared, retrying `writeExperience`).
- Draft scene documents (`Surprise.draftVersionId`, additive migration); last 30 drafts kept; publishing freezes the draft.
- New document editor for these surprises: scene list and settings, block palette from the registry, forms generated from each block's schema, autosave, undo/redo (also Cmd/Ctrl+Z), preview that follows the selected scene.
- Fixes found while testing: rapid undo skipping steps; duplicated "things they love"; editor columns cramped on mid-size screens.

## 2026-11-25 — Phase 2: scene/block engine
- New `src/engine`: block registry (heading, paragraph, handwritten, quote, letter, image, gallery, treasure_hunt, timeline, quiz, gift_reveal, cards, open_when, confetti), validated scene document, pure editing operations, legacy converter.
- One scene player replaces the per-experience shell for recipients and the editor preview: transitions, progress bar, back, resume after refresh, locked-scene card.
- Publishing now freezes a `SurpriseVersion`; **Publish changes** updates what recipients see and keeps the link. Links published earlier keep working and are frozen on their first edit.
- Time-locked scenes and letters are withheld on the server.
- Docs: ARCHITECTURE.md, DATABASE_DESIGN.md, INTEGRATION_TESTS.md.

## 2026-11-25
- **Database moved from Postgres to SQLite** (Prisma libsql adapter), file under Embarko's `DATA_DIR` in production, `./data/dev.db` locally. Existing local data copied across (7 users, 11 surprises, sessions, connections, deliveries, reminders). Old Postgres migration and schema kept in `prisma/archive/`; the local Postgres database was left untouched as a fallback. Tests 26/26 and live email test 9/9 pass on SQLite.
- Phase 1 audit and evolution plan (`SURPRISEME_AUDIT.md`) approved.
- Gmail connect asks for the full Gmail permission set (viaSocket `Send_Email` scope gap, reported `row0904nyxej`); Reconnect button; friendly permission error.
- Fixed: dashboard filter buttons clipped; Back on the first studio step; impossible reminder dates crashing (500 → 400); open-when envelope layout.
- Initial build: landing, guided studio, AI for 6 experiences, editor, publishing, recipient experiences, Gmail delivery + scheduling, calendar reminders, dashboard, guest sessions.
