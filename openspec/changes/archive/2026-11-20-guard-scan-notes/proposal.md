# Proposal: Guard scan notes

## Why

The guard can confirm or reject a scan, but the audit trail only records the
action and the pass rule. When something unusual happens at the gate — the
visitor arrives with extra luggage, a document needs a comment, or the guard
needs to explain a rejection — there is no place to leave that context for the
next shift or the administrator.

## What Changes

- Add an optional observation/note to the scan confirmation and rejection.
- The note field is always visible in the scan result; the guard has only **Confirmar** and **Denegar**. Confirmation sends the note when present and omits it when empty.
- On rejection, the note is optional. When present it becomes the rejection reason; when absent the existing `denied_by_guard` reason is used.
- Trim the note, limit it to 500 characters, and reject longer notes with the existing validation error shape.
- Persist the note on the scan (`pass_scans.note`) and in the bitacora entry `details.note` so it is visible in the audit and guard activity.
- Show the note in the guard activity list as «Novedad: …», without duplicating it when it also acts as the rejection reason.
- Keep the confirmation prompt scrollable so companions, note and actions remain reachable on small screens.

## Capabilities

### New Capabilities

- `guard-scan-notes`: optional guard observations on scan confirmation and rejection, with persistence and audit visibility.

### Modified Capabilities

None.

## Impact

- Database: nullable `note` column on `pass_scans` (migration 0024).
- API: scan confirm/reject schemas and services (`server/api/src/schemas/index.ts`, `routes/access.routes.ts`, `services/access-scan.service.ts`).
- Guard app: `app/scan.tsx`, `src/api/access.ts`, `src/lib/bitacora.ts`.
- Tests: focused API coverage for confirm/reject with notes and the 500-character limit.
- No changes to QR signing, scan authorization, entry/exit semantics, use counters, dashboard or pass-web.
- The behavior was implemented in commit 3884649 and is documented here retroactively.
