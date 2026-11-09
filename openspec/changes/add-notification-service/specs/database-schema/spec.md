## ADDED Requirements

### Requirement: Notifications table

The system SHALL have a `notifications` table for the in-app center and history.

#### Scenario: Notification columns
- **WHEN** the schema is inspected
- **THEN** `notifications` includes `id`, `user_id`, `community_id`, `type`, `channel`,
  `title`, `body`, `data`, `deep_link`, `dedup_key`, `status`, `read_at`, `created_at`

#### Scenario: Notification indexes
- **WHEN** the migration is applied
- **THEN** indexes exist on `(user_id, read_at, created_at DESC)` and `(dedup_key)`

### Requirement: Notification preferences table

The system SHALL have a `notification_preferences` table.

#### Scenario: Preference columns
- **WHEN** the schema is inspected
- **THEN** `notification_preferences` includes `id`, `user_id`, `community_id`, `type`,
  `channel`, `enabled`, `quiet_hours_start`, `quiet_hours_end`, timestamps

#### Scenario: Unique preference
- **WHEN** a duplicate preference is inserted for the same
  `(user_id, community_id, type, channel)`
- **THEN** the database rejects it

### Requirement: Push devices table

The system SHALL have a `push_devices` table.

#### Scenario: Push device columns
- **WHEN** the schema is inspected
- **THEN** `push_devices` includes `id`, `user_id`, `platform`, `token`,
  `device_name`, `status`, `last_seen_at`, `created_at`, `updated_at`

#### Scenario: Unique token
- **WHEN** a duplicate token is inserted
- **THEN** the database rejects it or the row is updated

#### Scenario: Token index
- **WHEN** the migration is applied
- **THEN** an index exists on `(user_id, status)`
