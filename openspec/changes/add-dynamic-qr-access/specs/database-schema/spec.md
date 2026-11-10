## ADDED Requirements

### Requirement: Access passes table

The system SHALL have an `access_passes` table for dynamic QR passes.

#### Scenario: Pass columns

- **WHEN** the schema is inspected
- **THEN** `access_passes` includes `id`, `community_id`, `location_unit_id`,
  `structure_id`, `created_by_person_id`, `authorized_by_person_id`,
  `authorized_by_delegation_id`, `visitor_first_name`, `visitor_last_name`,
  `visitor_document`, `has_vehicle`, `vehicle_plate`, `type`, `valid_from`,
  `valid_until`, `allowed_days`, `time_from`, `time_to`, `status`, `presence_state`,
  `link_token_hash`, `link_expires_at`, `device_key_hash`, `pin_hash`, `pin_enabled`,
  `pin_failed_attempts`, `pin_locked_until`, `bound_at`, `entry_at`, `exit_at`,
  `entry_count`, `exit_count`, `created_at`, `updated_at`

#### Scenario: Location references

- **WHEN** a pass is created
- **THEN** `location_unit_id` references a `location_units` row in the same community
- **THEN** `structure_id` references the structure that contains that unit
- **THEN** the unit is a leaf (`level_position = level_count`)

#### Scenario: Pass indexes

- **WHEN** the migration is applied
- **THEN** a unique index exists on `link_token_hash`
- **THEN** indexes exist on `(community_id, status)`,
  `(location_unit_id, created_at DESC)`, and `(valid_until) WHERE status = 'active'`

#### Scenario: Reserved delegation

- **WHEN** the MVP schema is inspected
- **THEN** `authorized_by_delegation_id` is nullable and has no foreign key
- **THEN** the pass service stores `NULL` until the subuser change is implemented

### Requirement: Pass scans table

The system SHALL have a `pass_scans` table for the bitácora.

#### Scenario: Scan columns

- **WHEN** the schema is inspected
- **THEN** `pass_scans` includes `id`, `pass_id`, `guard_person_id`, `guard_account_id`,
  `community_id`, `location_unit_id`, `structure_id`, `visitor_first_name`,
  `visitor_last_name`, `visitor_document`, `vehicle_plate`, `action`, `result`, `reason`,
  `token_jti`, `status`, `scanned_at`, `confirmed_at`

#### Scenario: Guard references

- **WHEN** a scan is created
- **THEN** `guard_person_id` references the `people` row of the guard
- **THEN** `guard_account_id` optionally references the `accounts` row used to log in

#### Scenario: Unique token jti

- **WHEN** a scan is inserted with a `token_jti` already used
- **THEN** the database rejects it with a unique constraint violation

#### Scenario: Scan indexes

- **WHEN** the migration is applied
- **THEN** a unique index exists on `token_jti`
- **THEN** indexes exist on `(pass_id, scanned_at DESC)`,
  `(community_id, scanned_at DESC)`, and `(status, scanned_at)` for pending cleanup

### Requirement: Pass alerts table

The system SHALL have a `pass_alerts` table reserved for missing-exit alerts.

#### Scenario: Alert columns

- **WHEN** the schema is inspected
- **THEN** `pass_alerts` includes `id`, `pass_id`, `community_id`, `type`, `status`,
  `due_at`, `created_at`, `resolved_at`, `resolved_by_person_id`

#### Scenario: One open alert per pass and type

- **WHEN** an open alert already exists for the same pass and type
- **THEN** the database rejects a duplicate open alert
- **THEN** the constraint is a partial unique index on `(pass_id, type)`
  `WHERE status = 'open'`

#### Scenario: MVP reserved

- **WHEN** the MVP runs
- **THEN** no missing-exit worker is enabled
- **THEN** the table stays empty until Phase 2

### Requirement: Outbox topic

The outbox SHALL route events by topic.

#### Scenario: Topic column

- **WHEN** the schema is inspected
- **THEN** `outbox_events` includes `topic` varchar(20) NOT NULL default `events`

#### Scenario: Existing rows

- **WHEN** the migration runs
- **THEN** existing outbox rows are set to `topic = 'events'`

#### Scenario: Topic index

- **WHEN** the migration is applied
- **THEN** an index exists on `(topic, status, available_at)`

#### Scenario: Main worker only

- **WHEN** the MVP outbox worker polls
- **THEN** it claims only rows with `topic = 'events'`
- **THEN** notification rows are not produced until Phase 2
