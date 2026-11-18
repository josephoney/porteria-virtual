## ADDED Requirements

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

### Requirement: Confirm with note action

The guard scan result SHALL offer both **Confirmar** and **Confirmar con nota**.
The second action MUST remain disabled until the trimmed note is non-empty.

#### Scenario: Note required for the second action

- **WHEN** the note field is empty or contains only whitespace
- **THEN** Confirmar con nota is disabled and Confirmar remains available

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

The guard activity and bitacora entry SHALL display the note as «Novedad: …»
without showing the same text twice when it also acts as the rejection reason.

#### Scenario: Note in the activity list

- **WHEN** a scan has a note
- **THEN** the guard activity shows the note once, labelled as a novedad

### Requirement: Authorization semantics unchanged

Notes SHALL NOT change QR validity, scan authorization, entry/exit behavior or
use counters.

#### Scenario: Note does not alter the scan decision

- **WHEN** the guard confirms or rejects a scan with a note
- **THEN** the pass state and use counters change exactly as they would without a note
