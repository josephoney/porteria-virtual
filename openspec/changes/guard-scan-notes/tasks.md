# Tasks: guard-scan-notes

> Implemented in commit 3884649 and documented retroactively. No new code is
> required by this change.

## 1. Data and API

- [x] 1.1 Add a nullable `note` column to `pass_scans` and generate migration 0024.
- [x] 1.2 Accept an optional trimmed note (max 500) on scan confirmation.
- [x] 1.3 Accept an optional note on rejection; default to `denied_by_guard` when absent.
- [x] 1.4 Persist the note on the scan and in the bitacora `details.note`.
- [x] 1.5 Cover confirm-with-note, reject-with-note and the 500-character limit with API tests.

## 2. Guard app

- [x] 2.1 Add the «Novedad / observación» field to the QR scan result.
- [x] 2.2 Add Confirmar, Confirmar con nota and Denegar; disable the middle action until the note is non-empty.
- [x] 2.3 Show the note in the guard activity as «Novedad: …» without duplicating the rejection reason.
- [x] 2.4 Keep the scan result sheet scrollable when companions and the note are present.

## 3. Verification

- [x] 3.1 Build shared/database and typecheck the API.
- [x] 3.2 Typecheck the guard app and format with Prettier.
- [x] 3.3 Pass the focused passes suite (34/34) and the full integration suite (147/147).
- [x] 3.4 Apply migration 0024 to the local database.
