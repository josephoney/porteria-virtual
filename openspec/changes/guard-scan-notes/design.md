# Design: Guard scan notes

## Context

The guard app confirms or rejects a pending scan from the QR result sheet. The
scan row already stores the action, status and rejection reason; bitacora
entries store the visitor, destination and rule snapshot. There is no general
observation field. The API and guard app already have the confirm/reject
endpoints, so this change adds a small, backward-compatible payload and a
nullable column.

## Goals / Non-Goals

**Goals**

- Let the guard leave an optional observation on confirmation and rejection.
- Persist the observation with the scan and in the audit entry.
- Keep the action explicit: Confirmar, Confirmar con nota, Denegar.
- Keep the note bounded and trimmed.
- Preserve the existing authorization, QR, entry/exit and use-count behavior.

**Non-Goals**

- Free-form notes outside the scan flow.
- Editing or deleting notes after the action.
- Attaching files or photos.
- Changing the rejection reason taxonomy beyond the optional note.
- Dashboard or public-web note editing.

## Decisions

1. **Nullable `note` on `pass_scans`.** One observation belongs to one scan
   action. A separate notes table would add a join and lifecycle for no current
   benefit. The column is nullable so old scans and notes-free actions stay
   valid. Migration 0024 is a single `ADD COLUMN "note" text`.

2. **Trim and cap at 500 characters in the API schema.** The mobile field uses
   the same limit and a character counter. Longer input fails with the existing
   validation response, not a new error envelope.

3. **Confirm and reject share the note concept but not the meaning.** On
   confirmation the note is an observation. On rejection it doubles as the
   reason, so `reason` and `note` can carry the same text; the activity list
   suppresses the mapped reason when it would repeat the note. When neither is
   present, rejection falls back to `denied_by_guard`.

4. **Audit snapshots.** The note is copied to the bitacora `details.note` for
   `pass_entry`, `pass_exit` and `pass_rejected`. This keeps the audit readable
   even if the scan row is later archived.

5. **UI actions.** The scan result offers Confirmar, Confirmar con nota and
   Denegar. The middle action is disabled until the trimmed note is non-empty.
   Denegar accepts an empty note. The result sheet is scrollable so up to ten
   companions, the note and the actions fit on small screens.

6. **No semantic changes.** Notes do not alter the scan result, QR token,
   authorization, entry/exit counts or uses.

## Risks / Trade-offs

- **Sensitive free text.** Guards may type personal data. The field is capped
  and only visible to authorized guard/admin surfaces; no public exposure.
- **Note as reason.** Reusing the note as the rejection reason avoids asking the
  guard for the same text twice, but the activity must not display it twice.
- **UI density.** Companions plus the note can grow the sheet; the scroll
  container is part of the design.
- **No edit/delete.** Corrections require a new note in a future flow; this is
  deliberate to keep the audit append-only.

## Migration Plan

- Apply migration 0024 (`ALTER TABLE "pass_scans" ADD COLUMN "note" text;`).
- No backfill: existing scans keep `null`.
- The migration runs before the API in the staging compose, as with previous
  changes.

## Open Questions

None for the current scope. Editing notes and attaching evidence are future
work.
