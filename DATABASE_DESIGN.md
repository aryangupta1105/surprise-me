# Database design

SQLite via Prisma 7 + `@prisma/adapter-libsql`. File: `$DATA_DIR/surpriseme.db` on Embarko (not backed up by Embarko), `./data/dev.db` locally. Migrations in `prisma/migrations` (applied with `prisma migrate deploy`; never schema-diffing at startup, which Embarko refuses). The old Postgres schema and migration are kept in `prisma/archive/`.

| Table | Purpose | Notes |
| --- | --- | --- |
| `User` | guest or account (`isGuest`) | `id` is also the viaSocket user id |
| `Session` | login cookie | only SHA-256 of the token stored |
| `Surprise` | one surprise | studio `input` JSON, legacy `content` JSON (being replaced by versions), `theme`, link hash + AES-GCM ciphertext, revoke/expiry, engagement counters, `publishedVersionId` |
| `SurpriseVersion` | immutable scene document snapshot | `source`: publish / legacy (later autosave / ai / template) |
| `AIGeneration` | every AI call, success or failure | thread id, model, error |
| `Upload` | the media library: `kind` (image/audio/video), `status` (pending → ready after the type check), `name`, `mime`, `size`, `storageKey` (R2 or `DATA_DIR/media`; shared by duplicated surprises), `data` (only photos stored before Phase 4) | extended in Phase 4 instead of a new `MediaAsset` table, so existing ids in documents keep working |
| `IntegrationConnection` | a user's viaSocket connection per app | `authId` is a server-side credential reference |
| `Delivery` | email send / schedule | unique `idempotencyKey`, atomic SCHEDULED → SENDING claim |
| `CalendarReminder` | Google Calendar event made for the user | |

Planned (approved in `SURPRISEME_AUDIT.md`): `ContributionInvite`, `Contribution`, `Reaction`, `AuditEvent`, user `Template` tables when users can save templates. All additive; destructive steps (dropping `Surprise.content`, `Upload`) only with separate approval.

## Migration log

| Migration | Change |
| --- | --- |
| `*_init_sqlite` | full schema on SQLite (data copied from local Postgres, 2026-11-25) |
| `*_surprise_versions` | `SurpriseVersion` table, `Surprise.publishedVersionId` (additive) |
| `*_draft_version` | `Surprise.draftVersionId` (additive): the document being edited |
| `*_accounts_and_sharing` | `User.passwordHash`, `Surprise.linkPasswordHash/inviteTokenHash`, tables `AiUse`, `Reaction`, `Contribution` (additive) |
| `*_media_library` | `Upload.kind/status/name/storageKey`, `data` nullable, indexes (SQLite table rebuild; all rows copied) |
