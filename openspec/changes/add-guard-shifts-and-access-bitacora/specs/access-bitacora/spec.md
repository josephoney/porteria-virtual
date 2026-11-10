## ADDED Requirements

### Requirement: Immutable bitácora per physical place

The system SHALL keep one append-only bitácora per community and access point.

#### Scenario: Entry belongs to a place

- **WHEN** a bitácora entry is created
- **THEN** it stores `community_id`, `access_point_id` and an `access_point_name`
  snapshot
- **THEN** it stores the author, source, timestamp and details

#### Scenario: Entries cannot be changed

- **WHEN** a client sends `PATCH` or `DELETE` to a bitácora entry
- **THEN** the API returns 404 or 405
- **THEN** a direct SQL `UPDATE` on `bitacora_entries` is rejected by the database
  trigger

#### Scenario: No pending scans

- **WHEN** a scan is created with `status = 'pending'`
- **THEN** no bitácora entry is written
- **THEN** the entry is written only when the scan is confirmed, rejected or denied

### Requirement: Automatic entries

The system SHALL write bitácora entries automatically for closed guard actions.

#### Scenario: Confirmed entry

- **WHEN** a guard confirms an entry scan
- **THEN** a `pass_entry` entry is written with the pass, scan, visitor snapshot,
  vehicle plate, location path, authorizer and access point

#### Scenario: Confirmed exit

- **WHEN** a guard confirms an exit scan
- **THEN** a `pass_exit` entry is written with the same snapshot

#### Scenario: Rejected scan

- **WHEN** a guard rejects a pending scan
- **THEN** a `pass_rejected` entry is written with the reason
- **THEN** the pass state does not change

#### Scenario: Denied scan

- **WHEN** a scan is denied by policy or token validation
- **THEN** a `scan_denied` entry is written with the reason, the access point and the
  shift
- **THEN** the raw QR or link token is never stored

#### Scenario: Shift events

- **WHEN** a guard starts, ends or changes access point
- **THEN** `shift_start`/`shift_end` entries are written for the affected places

### Requirement: Manual entries

The system SHALL let authorized users add manual entries from the dashboard.

#### Scenario: Guard manual entry

- **WHEN** a guard with an open segment at an access point adds a manual entry
- **THEN** a `manual` entry is written with source `dashboard`, the guard as author and
  the access point of the shift

#### Scenario: Admin manual entry

- **WHEN** a community or organization admin adds a manual entry
- **THEN** the entry is written with source `dashboard` and the admin as author
- **THEN** the access point must belong to the admin's scope

#### Scenario: Manual entry validation

- **WHEN** the summary is empty or too long
- **THEN** the response has status 400

### Requirement: Comments as additions

The system SHALL allow additional comments without modifying the original entry.

#### Scenario: Add comment

- **WHEN** an authorized user comments on an entry
- **THEN** a comment row is created with author, body and timestamp
- **THEN** the original entry is unchanged

#### Scenario: Comments cannot be edited

- **WHEN** a client tries to update or delete a comment
- **THEN** the API does not expose that operation
- **THEN** the database trigger rejects updates

### Requirement: Bitácora permissions

The system SHALL scope bitácora access by role, community and access point.

#### Scenario: Guard scope

- **WHEN** a guard lists the bitácora
- **THEN** they only see access points where they have a shift (open or closed)

#### Scenario: Admin scope

- **WHEN** a community admin lists the bitácora
- **THEN** they see every access point of their community
- **THEN** an org admin sees every community of their organization

#### Scenario: Platform admin

- **WHEN** a platform admin lists the bitácora
- **THEN** they must provide `communityId`
- **THEN** the access is read-only

#### Scenario: Operator and resident

- **WHEN** an operator or resident requests the bitácora
- **THEN** the response has status 403

### Requirement: Single source of truth for the UI

The dashboard and app SHALL read the access bitácora from `bitacora_entries`, not from
technical events or raw scans.

#### Scenario: Dashboard list

- **WHEN** the dashboard renders the access bitácora
- **THEN** it calls `GET /api/bitacora`
- **THEN** it does not use `GET /api/events` for access entries

#### Scenario: Technical audit

- **WHEN** the user opens Auditoría
- **THEN** the existing events view is shown separately
- **THEN** it is not labeled as the access bitácora

### Requirement: PII handling

The system SHALL protect visitor documents and vehicle plates in list responses.

#### Scenario: Masked list

- **WHEN** the bitácora list returns an entry with a visitor document
- **THEN** the document is masked
- **THEN** the detail endpoint returns the full value only to authorized roles

#### Scenario: No raw tokens

- **WHEN** an entry is written or logged
- **THEN** it never contains the raw QR token or link token
