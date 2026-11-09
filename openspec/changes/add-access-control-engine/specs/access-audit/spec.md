## ADDED Requirements

### Requirement: Access logs table

The system SHALL persist every access decision in an append-only `access_logs` table.

#### Scenario: Log allowed access

- **WHEN** the engine decides `allow`
- **THEN** a row is inserted with `community_id`, `access_point_id`, `device_id`,
  `credential_id`, `subject_type`, `subject_id`, `decision`, `reason`,
  `matched_rule_id`, `direction`, and `created_at`

#### Scenario: Log denied access

- **WHEN** the engine decides `deny`
- **THEN** a row is inserted with the same fields and the denial reason

#### Scenario: Log offline decision

- **WHEN** a device synced an offline decision
- **THEN** the row is inserted with `source = 'offline'` and the original
  `occurred_at` timestamp
- **THEN** the server marks the row as reconciled

#### Scenario: Append-only

- **WHEN** an access log is written
- **THEN** it cannot be updated or deleted through the API
- **THEN** retention is handled only by an administrative job

### Requirement: Access events

The system SHALL emit access events to the event log for analytics and the bitácora.

#### Scenario: Granted event

- **WHEN** an access is allowed
- **THEN** an `access.granted` event is emitted with actor, community, access point, and
  credential metadata

#### Scenario: Denied event

- **WHEN** an access is denied
- **THEN** an `access.denied` event is emitted with the denial reason

#### Scenario: Actuation failure event

- **WHEN** actuation fails after an allow
- **THEN** an `access.actuation_failed` event is emitted

### Requirement: Access log query

The API SHALL expose a paginated, filterable access log for authorized roles.

#### Scenario: Query by community and date

- **WHEN** an admin requests access logs with `communityId` and a date range
- **THEN** the response is paginated and ordered by `created_at DESC`

#### Scenario: Filter by decision

- **WHEN** a request includes `?decision=deny`
- **THEN** only denied accesses are returned

#### Scenario: Filter by subject or access point

- **WHEN** a request includes `subjectId` or `accessPointId`
- **THEN** only matching rows are returned

#### Scenario: Unauthorized role

- **WHEN** a resident requests the access log
- **THEN** the response has status 403

### Requirement: Retention and privacy

Access logs SHALL follow a configurable retention policy.

#### Scenario: Retention window

- **WHEN** a log is older than the configured retention window
- **THEN** an administrative job purges it
- **THEN** the purge is itself audited

#### Scenario: Sensitive fields

- **WHEN** an access log is stored
- **THEN** it never contains raw credentials, PINs, tokens, or biometric templates
