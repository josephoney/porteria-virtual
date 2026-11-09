## ADDED Requirements

### Requirement: Devices table

The system SHALL have a `devices` table for access hardware.

#### Scenario: Device columns
- **WHEN** the schema is inspected
- **THEN** `devices` includes `id`, `community_id`, `access_point_id`,
  `name`, `type`, `driver`, `identifier`, `secret_ref`, `capabilities`, `status`,
  `last_seen_at`, `created_at`, `updated_at`

#### Scenario: Device indexes
- **WHEN** the migration is applied
- **THEN** indexes exist on `(community_id, status)` and `(identifier)`

#### Scenario: Unique identifier
- **WHEN** two devices are inserted with the same `identifier`
- **THEN** the database rejects the duplicate

### Requirement: Device commands table

The system SHALL have a `device_commands` outbox table.

#### Scenario: Command columns
- **WHEN** the schema is inspected
- **THEN** `device_commands` includes `id`, `device_id`, `community_id`, `command`,
  `payload`, `request_id`, `status`, `attempts`, `available_at`, `sent_at`,
  `acked_at`, `last_error`, `created_at`

#### Scenario: Command indexes
- **WHEN** the migration is applied
- **THEN** indexes exist on `(status, available_at)` and
  `(device_id, request_id)` with uniqueness

### Requirement: Relay output association

Relay outputs SHALL be associated with a device.

#### Scenario: Relay belongs to device
- **WHEN** the schema is inspected
- **THEN** `relay_outputs` includes `device_id` referencing `devices`

#### Scenario: Backfill relay device
- **WHEN** the migration runs
- **THEN** each existing kiosk becomes a `device` of type `kiosk`
- **THEN** its relay outputs reference that device
