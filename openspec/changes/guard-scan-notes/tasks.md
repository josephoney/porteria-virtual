# Tasks: guard-scan-notes

> Implemented in commit 3884649 and documented retroactively. The three-action
> UI was corrected to a single Confirmar/Denegar pair with an always-visible
> optional note.

## 1. Data and API

- [x] 1.1 Add a nullable `note` column to `pass_scans` and generate migration 0024.
- [x] 1.2 Accept an optional trimmed note (max 500) on scan confirmation.
- [x] 1.3 Accept an optional note on rejection; default to `denied_by_guard` when absent.
- [x] 1.4 Persist the note on the scan and in the bitacora `details.note`.
- [x] 1.5 Cover confirm-with-note, reject-with-note and the 500-character limit with API tests.
- [x] 1.6 Prove the note is visible through the bitacora list endpoint (`shiftId` filter) used by the guard activity.

## 2. Guard app

- [x] 2.1 Add the «Novedad / observación» field to the QR scan result.
- [x] 2.2 Offer only Confirmar and Denegar; Confirmar sends the note when it is non-empty and omits it when empty.
- [x] 2.3 Denegar sends the note when present and falls back to `denied_by_guard` when empty.
- [x] 2.4 Show the note in the guard activity as «Novedad: …» without duplicating the rejection reason.
- [x] 2.5 Keep the scan result sheet scrollable when companions and the note are present.

## 3. Verification

- [x] 3.1 Build shared/database and typecheck the API.
- [x] 3.2 Typecheck the guard app and format with Prettier.
- [x] 3.3 Pass the focused passes suite and the full integration suite.
- [x] 3.4 Apply migration 0024 to the local database.
