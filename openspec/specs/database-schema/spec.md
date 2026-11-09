## Purpose

Defines the persistence schema for the multi-tenant platform: organizations, communities, buildings, units, memberships, users, kiosks, calls, access points and audit events.
## Requirements
### Requirement: Organizations table
The system SHALL have an `organizations` table with UUID primary key, name, and timestamps.

#### Scenario: Create organization
- **WHEN** a row is inserted into `organizations` with a name
- **THEN** the row is persisted with an auto-generated UUID, `created_at`, and `updated_at`

#### Scenario: Unique organization name
- **WHEN** a row is inserted with a name that already exists
- **THEN** the database rejects the insertion with a unique constraint violation

### Requirement: Access points table
The system SHALL have an `access_points` table with type enum (door, gate, turnstile),
GPIO pin number, and a reference to a `community`.

#### Scenario: Access point types
- **WHEN** a row is inserted with `type = 'door'`
- **THEN** the value is accepted

#### Scenario: Invalid access point type
- **WHEN** a row is inserted with an invalid type value
- **THEN** the database rejects the insertion with a check constraint violation

#### Scenario: Access point scoped to community
- **WHEN** an access point is created with `community_id`
- **THEN** it is linked to that community
- **THEN** deleting the community cascades to its access points

### Requirement: Kiosks table
The system SHALL have a `kiosks` table linked to a `community` and, optionally, to an
`access_point` with a one-to-one relationship.

#### Scenario: Kiosk belongs to community
- **WHEN** a kiosk is created
- **THEN** `community_id` is required and references an existing community

#### Scenario: One kiosk per access point
- **WHEN** a kiosk is created with an `access_point_id` that already has a kiosk
- **THEN** the database rejects the insertion with a unique constraint violation

#### Scenario: Kiosk without access point
- **WHEN** a kiosk is created with `access_point_id = NULL`
- **THEN** the insertion is accepted
- **THEN** the kiosk remains usable for intercom until an access point is assigned

#### Scenario: Kiosk heartbeat tracking
- **WHEN** a kiosk sends a heartbeat
- **THEN** the `last_heartbeat` timestamp is updated

### Requirement: Users table
The system SHALL have a global `users` table with a globally unique email, hashed
password, name, active flag, and platform-admin flag. Authorization roles MUST live in
`memberships`, not on the user.

#### Scenario: User is a global identity
- **WHEN** a user is created with an email already present in `users`
- **THEN** the database rejects the insertion with a unique constraint violation

#### Scenario: User without tenant role
- **WHEN** a user row is inserted
- **THEN** it does not contain `role`, `organization_id`, or `location_id`
- **THEN** tenant access is granted only through memberships

#### Scenario: Platform admin flag
- **WHEN** a user is created with `is_platform_admin = true`
- **THEN** the value is persisted
- **THEN** it defaults to `false` when omitted

#### Scenario: Password is never returned in queries
- **WHEN** a user is selected from the database
- **THEN** the `password_hash` column exists in the schema but is never exposed in API
  responses

### Requirement: Visitors table
The system SHALL have a `visitors` table with type (permanent, temporary, delivery), validity period, and photo URL.

#### Scenario: Temporary visitor with expiration
- **WHEN** a visitor is created with `type = 'temporary'` and `valid_until` set
- **THEN** the validity period is stored and can be checked against current time

#### Scenario: Visitor linked to organization
- **WHEN** a visitor is created with a valid `organization_id`
- **THEN** the visitor is scoped to that organization

### Requirement: Calls table
The system SHALL have a `calls` table tracking WebRTC calls with status (pending,
active, ended, missed) and duration, scoped to a community.

#### Scenario: Call lifecycle
- **WHEN** a call is created with `status = 'pending'`
- **THEN** the row is persisted
- **WHEN** the call is answered and `status` is updated to `'active'`
- **THEN** the change is persisted

#### Scenario: Call with zero duration
- **WHEN** a call is ended before being answered
- **THEN** `duration` is NULL and `status` is `'missed'`

#### Scenario: Call community scoping
- **WHEN** a call is created
- **THEN** it stores `community_id` derived from the kiosk
- **THEN** `access_point_id` is nullable

### Requirement: Events table with TimescaleDB
The system SHALL have an `events` table configured as a TimescaleDB hypertable,
partitioned by `created_at` in 7-day chunks, scoped by organization and community.

#### Scenario: Hypertable creation
- **WHEN** the migration is applied
- **THEN** `events` is converted to a hypertable with `chunk_time_interval = 7 days`

#### Scenario: Time-range query performance
- **WHEN** querying events for a specific week
- **THEN** only the relevant chunks are scanned, not the entire table

#### Scenario: Event metadata as JSONB
- **WHEN** an event is created with `metadata = { "door_id": "abc", "method": "qr_code" }`
- **THEN** the metadata is stored as JSONB and queryable with PostgreSQL JSON operators

#### Scenario: Event community scoping
- **WHEN** an event is inserted
- **THEN** `community_id` references the community where it occurred
- **THEN** the former `location_id` column is no longer used

### Requirement: Guard rounds table
The system SHALL have a `guard_rounds` table defining round routes with scheduled time
and completion tracking, scoped to a community.

#### Scenario: Guard round with checkpoints
- **WHEN** a guard round is created with `scheduled_at`
- **THEN** the round is linked to a guard (user) and a community

#### Scenario: Round completion
- **WHEN** all checkpoints of a round are scanned
- **THEN** `completed_at` is set and `status` changes to `'completed'`

#### Scenario: Round community scoping
- **WHEN** a guard round is created
- **THEN** `community_id` is required and references a community of the guard's
  organization

### Requirement: Guard checkpoints table
The system SHALL have a `guard_checkpoints` table defining ordered checkpoints within a round.

#### Scenario: Ordered checkpoints
- **WHEN** checkpoints are created with sequential `order_index` values
- **THEN** they maintain the order for sequential scanning

#### Scenario: Checkpoint scan
- **WHEN** a guard scans a checkpoint QR
- **THEN** `scanned_at` is set with the timestamp

### Requirement: Access codes table
The system SHALL have an `access_codes` table for temporary QR access codes with validity window and usage tracking.

#### Scenario: One-time use access code
- **WHEN** an access code is used (`used_at` is set)
- **THEN** the code cannot be reused

#### Scenario: Expired access code
- **WHEN** `valid_until` is in the past
- **THEN** the code is considered invalid regardless of `used_at`

### Requirement: Refresh tokens table
The system SHALL have a `refresh_tokens` table for JWT refresh token rotation.

#### Scenario: Token revocation
- **WHEN** `revoked` is set to true
- **THEN** the token cannot be used for refresh

#### Scenario: Token expiration
- **WHEN** `expires_at` is in the past
- **THEN** the token is considered invalid regardless of `revoked`

### Requirement: Tenant slugs

The system SHALL add a unique `slug` column to `organizations` and `communities`.

#### Scenario: Organization slug column
- **WHEN** the schema is inspected
- **THEN** `organizations` includes `slug` varchar(60) NOT NULL
- **THEN** a unique index exists on `organizations.slug`

#### Scenario: Community slug column
- **WHEN** the schema is inspected
- **THEN** `communities` includes `slug` varchar(60) NOT NULL
- **THEN** a unique index exists on `communities.slug`

#### Scenario: Backfill existing rows
- **WHEN** the migration runs on existing data
- **THEN** every organization and community receives a slug derived from its name
- **THEN** collisions are resolved with a numeric suffix
- **THEN** `NOT NULL` is applied after the backfill

### Requirement: Invitations table

The system SHALL have an `invitations` table for onboarding.

#### Scenario: Invitation columns
- **WHEN** the schema is inspected
- **THEN** `invitations` includes `id`, `token_hash`, `email`, `organization_id`,
  `community_id`, `unit_id`, `role`, `status`, `expires_at`, `accepted_at`,
  `invited_by`, `created_at`, `updated_at`

#### Scenario: Invitation status enum
- **WHEN** the schema is inspected
- **THEN** `status` accepts `pending`, `accepted`, `revoked`, and `expired`

#### Scenario: Invitation indexes
- **WHEN** the migration is applied
- **THEN** a unique index exists on `token_hash`
- **THEN** indexes exist on `(email, status)` and `(community_id, status)`

#### Scenario: Cascade rules
- **WHEN** an organization or community is deleted
- **THEN** its invitations are deleted
- **WHEN** the inviting user is deleted
- **THEN** `invited_by` is set to null

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

### Requirement: Kiosk device credential

Kiosks SHALL have a device credential for signaling authentication.

#### Scenario: Device token column
- **WHEN** the schema is inspected
- **THEN** `kiosks` includes `device_token_hash` varchar(255) and `device_token_rotated_at`

#### Scenario: Provisioning
- **WHEN** a kiosk is provisioned
- **THEN** a random device token is generated and only its hash is stored
- **THEN** the raw token is returned once

#### Scenario: Rotation
- **WHEN** an admin rotates a kiosk token
- **THEN** the old hash is replaced and the old token stops working

### Requirement: Kiosk rpi uniqueness

The migration SHALL prevent ambiguous kiosk identities.

#### Scenario: Unique index
- **WHEN** the migration is applied
- **THEN** a unique constraint exists on `kiosks.rpi_id` (or on
  `(community_id, rpi_id)` if community-scoped resolution is chosen)

#### Scenario: Duplicate cleanup
- **WHEN** duplicates exist before applying the constraint
- **THEN** the migration renames the legacy row or removes the legacy organization
- **THEN** the migration fails loudly if it cannot resolve a duplicate safely

### Requirement: Legacy tenant isolation

The migration SHALL leave any legacy tenant isolated until a backup and maintenance
window allow destructive cleanup.

#### Scenario: Legacy organization remains isolated
- **WHEN** an organization with no active memberships is detected
- **THEN** its kiosks are renamed so they cannot collide with active `rpi_id` values
- **THEN** no user can obtain a membership context for that organization

#### Scenario: Cleanup follow-up
- **WHEN** the destructive cleanup is scheduled
- **THEN** a verified backup exists
- **THEN** the affected organization/community/kiosk/call counts are recorded before
  deletion

#### Scenario: Rollback
- **WHEN** the migration is rolled back
- **THEN** the documented rollback restores the unique/rpi state where possible

