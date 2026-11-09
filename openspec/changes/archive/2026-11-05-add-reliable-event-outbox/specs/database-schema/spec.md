## ADDED Requirements

### Requirement: Outbox events table

The system SHALL have an `outbox_events` table for reliable event delivery.

#### Scenario: Outbox table columns
- **WHEN** the schema is inspected
- **THEN** `outbox_events` includes `id`, `event_id`, `event_type`, `aggregate_type`,
  `aggregate_id`, `organization_id`, `community_id`, `payload`, `status`, `attempts`,
  `available_at`, `processed_at`, `last_error`, `created_at`

#### Scenario: Status enum
- **WHEN** the schema is inspected
- **THEN** the `status` column accepts only `pending`, `processing`, `done`, `dead`

#### Scenario: Delivery indexes
- **WHEN** the migration is applied
- **THEN** indexes exist on `(status, available_at)` and `(event_id)`

#### Scenario: Retention column
- **WHEN** a row is marked `done`
- **THEN** `processed_at` is set so the purge job can delete old rows
