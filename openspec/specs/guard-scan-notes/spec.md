# guard-scan-notes Specification

## Purpose
TBD - created by archiving change guard-scan-notes. Update Purpose after archive.
## Requirements
### Requirement: Optional note on confirmation

The scan confirmation API SHALL accept an optional note, trim it, limit it to
500 characters and persist it on the scan and in the corresponding bitacora
entry.

#### Scenario: Confirm with a note

- **WHEN** the guard confirms a pending scan with a non-empty note
- **THEN** the scan stores the trimmed note and the bitacora entry exposes it in its details

#### Scenario: Confirm without a note

- **WHEN** the guard confirms a pending scan without a note
- **THEN** the confirmation succeeds and the scan note stays null

### Requirement: Confirm and reject actions with an optional note

The guard scan result SHALL offer exactly two actions: **Confirmar** and
**Denegar**. The note field SHALL stay visible while the actions are available.
**Confirmar** MUST send the note when it contains non-whitespace text and omit
it otherwise. **Denegar** MUST send the note as the reason when present and fall
back to `denied_by_guard` when empty.

#### Scenario: Confirm sends the typed note

- **WHEN** the guard types a note and presses Confirmar
- **THEN** the confirmation includes the trimmed note

#### Scenario: Confirm with an empty note

- **WHEN** the note field is empty or contains only whitespace and the guard presses Confirmar
- **THEN** the confirmation succeeds without a note

#### Scenario: Two actions only

- **WHEN** the scan result is shown
- **THEN** the only available actions are Confirmar and Denegar

### Requirement: Reject note

The rejection API SHALL accept an optional note. When present, the note SHALL
be the rejection reason; when absent, the rejection MUST fall back to
`denied_by_guard`.

#### Scenario: Reject with a note

- **WHEN** the guard rejects a pending scan with a note
- **THEN** the scan and the bitacora rejection record both contain the note

#### Scenario: Reject without a note

- **WHEN** the guard rejects a pending scan without a note
- **THEN** the rejection reason is `denied_by_guard`

### Requirement: Note length limit

The API SHALL reject notes longer than 500 characters with the existing
validation error response.

#### Scenario: Note too long

- **WHEN** the guard submits a note of 501 characters
- **THEN** the request fails with a validation error and no scan action is recorded

### Requirement: Audit visibility

The guard activity list and the bitacora entry SHALL display the note as
«Novedad: …» without showing the same text twice when it also acts as the
rejection reason. The guard activity reads the bitacora list endpoint, so that
response MUST include the note through its entry details.

#### Scenario: Note in the activity list

- **WHEN** a scan with a note is listed in the guard activity
- **THEN** the list response includes the note and the activity shows it once, labelled as a novedad

#### Scenario: Detail parity

- **WHEN** the same bitacora entry is opened in detail
- **THEN** it exposes the same note as the activity list

### Requirement: Authorization semantics unchanged

Notes SHALL NOT change QR validity, scan authorization, entry/exit behavior or
use counters.

#### Scenario: Note does not alter the scan decision

- **WHEN** the guard confirms or rejects a scan with a note
- **THEN** the pass state and use counters change exactly as they would without a note

