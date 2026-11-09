## REMOVED Requirements

### Requirement: Locations table
**Reason**: Replaced by the `communities` table, which is a tenant-owned entity under
an organization and the anchor of the building/unit hierarchy.
**Migration**: The migration renames `locations` to `communities`, keeps its UUIDs, and
backfills `organization_id`, `address`, and `timezone`. Consumers query `communities`
instead of `locations`.

## MODIFIED Requirements

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
