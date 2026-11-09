## ADDED Requirements

### Requirement: Access passes table

The system SHALL have an `access_passes` table for dynamic QR passes.

#### Scenario: Pass columns
- **WHEN** the schema is inspected
- **THEN** `access_passes` includes `id`, `community_id`, `unit_id`, `created_by`,
  `visitor_first_name`, `visitor_last_name`, `visitor_document`, `has_vehicle`,
  `vehicle_plate`, `type`, `valid_from`, `valid_until`, `allowed_days`, `time_from`,
  `time_to`, `status`, `presence_state`, `link_token_hash`, `device_key_hash`,
  `pin_hash`, `pin_enabled`, `bound_at`, `entry_at`, `exit_at`, `entry_count`,
  `exit_count`, `created_at`, `updated_at`

#### Scenario: Pass indexes
- **WHEN** the migration is applied
- **THEN** indexes exist on `(community_id, status)`, `(unit_id, created_at DESC)`,
  and a unique index on `link_token_hash`

### Requirement: Pass scans table

The system SHALL have a `pass_scans` table for the bitácora.

#### Scenario: Scan columns
- **WHEN** the schema is inspected
- **THEN** `pass_scans` includes `id`, `pass_id`, `guard_id`, `community_id`, `unit_id`,
  `visitor_first_name`, `visitor_last_name`, `visitor_document`, `vehicle_plate`,
  `action`, `result`, `reason`, `token_jti`, `status`, `scanned_at`, `confirmed_at`

#### Scenario: Unique token jti
- **WHEN** a scan is inserted with a `token_jti` already used
- **THEN** the database rejects it with a unique constraint violation

#### Scenario: Scan index
- **WHEN** the migration is applied
- **THEN** an index exists on `(pass_id, scanned_at DESC)`

### Requirement: Pass alerts table

The system SHALL have a `pass_alerts` table.

#### Scenario: Alert columns
- **WHEN** the schema is inspected
- **THEN** `pass_alerts` includes `id`, `pass_id`, `community_id`, `type`, `status`,
  `due_at`, `created_at`, `resolved_at`, `resolved_by`

#### Scenario: One open alert per pass and type
- **WHEN** an open alert already exists for the same pass and type
- **THEN** the database rejects a duplicate open alert

### Requirement: Outbox topic

The outbox SHALL route events by topic.

#### Scenario: Topic column
- **WHEN** the schema is inspected
- **THEN** `outbox_events` includes `topic` varchar NOT NULL default `events`

#### Scenario: Existing rows
- **WHEN** the migration runs
- **THEN** existing outbox rows are set to `topic = 'events'`

#### Scenario: Topic index
- **WHEN** the migration is applied
- **THEN** an index exists on `(topic, status, available_at)`
