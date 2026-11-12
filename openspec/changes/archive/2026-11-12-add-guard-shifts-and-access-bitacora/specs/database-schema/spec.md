## MODIFIED Requirements

### Requirement: Access points table

The system SHALL have an `access_points` table with a name, type enum (door, gate,
turnstile), optional GPIO pin, direction, active flag and a reference to a `community`.

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

#### Scenario: Named access point

- **WHEN** a row is inserted with a name
- **THEN** the name is required and unique within the community

#### Scenario: Access point without GPIO

- **WHEN** a row is inserted with `gpio_pin = NULL`
- **THEN** the insertion is accepted

#### Scenario: Inactive access point

- **WHEN** `active = false`
- **THEN** new guard shifts cannot start at that access point
- **THEN** historical entries remain readable

## ADDED Requirements

### Requirement: Guard shifts table

The system SHALL have a `guard_shifts` table for personal guard work sessions.

#### Scenario: Shift fields

- **WHEN** a row is inserted
- **THEN** it includes `community_id`, `guard_person_id`, `guard_account_id?`, `status`,
  `started_at`, `ended_at?`, `ended_by_person_id?`, `closed_reason?`, `created_at` and
  `updated_at`

#### Scenario: One open shift per guard

- **WHEN** a second open shift is inserted for the same `guard_person_id`
- **THEN** the database rejects it with a unique constraint violation

#### Scenario: Multiple guards per access point

- **WHEN** two guards have open shifts with segments at the same access point
- **THEN** both rows are accepted

### Requirement: Guard shift segments table

The system SHALL have a `guard_shift_segments` table for the access point covered during
each part of a shift.

#### Scenario: Segment fields

- **WHEN** a row is inserted
- **THEN** it includes `shift_id`, `access_point_id`, `started_at`, `ended_at?`,
  `end_reason?` and `created_at`

#### Scenario: One open segment per shift

- **WHEN** a second open segment is inserted for the same `shift_id`
- **THEN** the database rejects it with a unique constraint violation

### Requirement: Bitácora entries table

The system SHALL have an immutable `bitacora_entries` table keyed by community and access
point.

#### Scenario: Entry fields

- **WHEN** a row is inserted
- **THEN** it includes `community_id`, `access_point_id`, `access_point_name`, `shift_id?`,
  `type`, `source`, `author_person_id?`, `author_account_id?`, `pass_id?`,
  `pass_scan_id?`, `summary`, `details` jsonb and `created_at`
- **THEN** it does not include `updated_at`

#### Scenario: Entry indexes

- **WHEN** the schema is inspected
- **THEN** indexes exist on `(community_id, access_point_id, created_at DESC)`,
  `(shift_id, created_at DESC)`, `(pass_id)` and `(type, created_at DESC)`

### Requirement: Bitácora comments table

The system SHALL have a `bitacora_comments` table for append-only additions.

#### Scenario: Comment fields

- **WHEN** a row is inserted
- **THEN** it includes `entry_id`, `author_person_id?`, `author_account_id?`, `body` and
  `created_at`

#### Scenario: Comment index

- **WHEN** the schema is inspected
- **THEN** an index exists on `(entry_id, created_at)`

### Requirement: Bitácora immutability

The system SHALL reject updates to bitácora entries and comments at the database level.

#### Scenario: Update rejected

- **WHEN** an `UPDATE` is executed on `bitacora_entries` or `bitacora_comments`
- **THEN** the database raises an exception

### Requirement: Bitácora destination and authorizer columns

The bitácora entries table SHALL store the visitor destination and the pass authorizer.

#### Scenario: Columns

- **WHEN** `bitacora_entries` is inspected
- **THEN** it includes `destination_location_unit_id?`, `destination_path?`,
  `authorized_by_person_id?` and `authorized_by_name?`

#### Scenario: Snapshot

- **WHEN** the destination location is renamed or deleted
- **THEN** `destination_path` and `authorized_by_name` keep their value

### Requirement: Pass scans access point and shift

The system SHALL link each QR scan to the shift and access point where it happened.

#### Scenario: Scan fields

- **WHEN** a scan is inserted
- **THEN** it stores `shift_id`, `access_point_id`, `access_point_name`,
  `confirmed_by_person_id?` and `confirmed_by_account_id?`

#### Scenario: Legacy rows

- **WHEN** a scan row predates the change
- **THEN** the new nullable columns remain `NULL`

### Requirement: Membership default access point

The system SHALL store an optional default access point on memberships.

#### Scenario: Default assignment

- **WHEN** a membership is updated with `default_access_point_id`
- **THEN** the value references an existing access point
- **THEN** deleting the access point sets the column to `NULL`
