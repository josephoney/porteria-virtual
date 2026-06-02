## ADDED Requirements

### Requirement: Organizations table
The system SHALL have an `organizations` table with UUID primary key, name, and timestamps.

#### Scenario: Create organization
- **WHEN** a row is inserted into `organizations` with a name
- **THEN** the row is persisted with an auto-generated UUID, `created_at`, and `updated_at`

#### Scenario: Unique organization name
- **WHEN** a row is inserted with a name that already exists
- **THEN** the database rejects the insertion with a unique constraint violation

### Requirement: Locations table
The system SHALL have a `locations` table referencing `organizations` via foreign key with CASCADE delete.

#### Scenario: Location belongs to organization
- **WHEN** a location is created with a valid `organization_id`
- **THEN** the row is persisted and linked to that organization

#### Scenario: Cascade delete organization
- **WHEN** an organization is deleted
- **THEN** all its associated locations are automatically deleted

### Requirement: Access points table
The system SHALL have an `access_points` table with type enum (door, gate, turnstile), GPIO pin number, and location reference.

#### Scenario: Access point types
- **WHEN** a row is inserted with `type = 'door'`
- **THEN** the value is accepted

#### Scenario: Invalid access point type
- **WHEN** a row is inserted with an invalid type value
- **THEN** the database rejects the insertion with a check constraint violation

### Requirement: Kiosks table
The system SHALL have a `kiosks` table with a one-to-one relationship to `access_points`.

#### Scenario: One kiosk per access point
- **WHEN** a kiosk is created with an `access_point_id` that already has a kiosk
- **THEN** the database rejects the insertion with a unique constraint violation

#### Scenario: Kiosk heartbeat tracking
- **WHEN** a kiosk sends a heartbeat
- **THEN** the `last_heartbeat` timestamp is updated

### Requirement: Users table
The system SHALL have a `users` table with role enum (admin, operator, guard, resident), hashed password, and organization reference.

#### Scenario: User with specific role
- **WHEN** a user is created with `role = 'operator'`
- **THEN** the value is persisted and retrievable

#### Scenario: Unique email per organization
- **WHEN** a user is created with an email that already exists in the same organization
- **THEN** the database rejects the insertion

#### Scenario: Password is never returned in queries
- **WHEN** a user is selected from the database
- **THEN** the `password_hash` column exists in the schema but is never exposed in API responses

### Requirement: Visitors table
The system SHALL have a `visitors` table with type (permanent, temporary, delivery), validity period, and photo URL.

#### Scenario: Temporary visitor with expiration
- **WHEN** a visitor is created with `type = 'temporary'` and `valid_until` set
- **THEN** the validity period is stored and can be checked against current time

#### Scenario: Visitor linked to organization
- **WHEN** a visitor is created with a valid `organization_id`
- **THEN** the visitor is scoped to that organization

### Requirement: Calls table
The system SHALL have a `calls` table tracking WebRTC calls with status (pending, active, ended, missed) and duration.

#### Scenario: Call lifecycle
- **WHEN** a call is created with `status = 'pending'`
- **THEN** the row is persisted
- **WHEN** the call is answered and `status` is updated to `'active'`
- **THEN** the change is persisted

#### Scenario: Call with zero duration
- **WHEN** a call is ended before being answered
- **THEN** `duration` is NULL and `status` is `'missed'`

### Requirement: Events table with TimescaleDB
The system SHALL have an `events` table configured as a TimescaleDB hypertable, partitioned by `created_at` in 7-day chunks.

#### Scenario: Hypertable creation
- **WHEN** the migration is applied
- **THEN** `events` is converted to a hypertable with `chunk_time_interval = 7 days`

#### Scenario: Time-range query performance
- **WHEN** querying events for a specific week
- **THEN** only the relevant chunks are scanned, not the entire table

#### Scenario: Event metadata as JSONB
- **WHEN** an event is created with `metadata = { "door_id": "abc", "method": "qr_code" }`
- **THEN** the metadata is stored as JSONB and queryable with PostgreSQL JSON operators

### Requirement: Guard rounds table
The system SHALL have a `guard_rounds` table defining round routes with scheduled time and completion tracking.

#### Scenario: Guard round with checkpoints
- **WHEN** a guard round is created with `scheduled_at`
- **THEN** the round is linked to a guard (user) and location

#### Scenario: Round completion
- **WHEN** all checkpoints of a round are scanned
- **THEN** `completed_at` is set and `status` changes to `'completed'`

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
