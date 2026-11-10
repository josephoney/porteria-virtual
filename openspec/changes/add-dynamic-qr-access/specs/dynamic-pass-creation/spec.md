## ADDED Requirements

### Requirement: Create access pass

The API SHALL let a resident create an access pass for a leaf location unit they are
associated with.

#### Scenario: Resident creates a pass

- **WHEN** an authenticated resident creates a pass for a leaf unit of their community
- **THEN** the pass is created with `status = 'active'` and a generated self-service link
- **THEN** the response includes the pass id and the share link
- **THEN** `created_by_person_id` and `authorized_by_person_id` are the resident's person id
- **THEN** `authorized_by_delegation_id` is `NULL`

#### Scenario: Required visitor fields

- **WHEN** a pass is created
- **THEN** it requires `locationUnitId`, `visitorFirstName`, `visitorLastName`,
  `visitorDocument`, `type`, `validFrom`, and `validUntil`
- **THEN** the server derives `communityId` and `structureId` from `locationUnitId`

#### Scenario: Leaf unit only

- **WHEN** `locationUnitId` points to a non-leaf unit (`level_position <> level_count`)
- **THEN** the response has status 400 with reason `invalid_location_unit`

#### Scenario: Resident outside own unit

- **WHEN** a resident tries to create a pass for a unit they are not associated with
- **THEN** the response has status 403

#### Scenario: Cross-tenant attempt

- **WHEN** a user creates a pass for a unit in another organization
- **THEN** the response has status 404

### Requirement: Pass types

The MVP SHALL support `entry_only` and `entry_exit`. `entry_exit_recurring` SHALL be
reserved for Phase 2.

#### Scenario: Entry only

- **WHEN** a pass is created with `type = 'entry_only'`
- **THEN** it allows a single confirmed entry and is then `used`

#### Scenario: Entry and exit

- **WHEN** a pass is created with `type = 'entry_exit'`
- **THEN** it allows one entry and one exit within `validFrom`/`validUntil`
- **THEN** the exit is allowed after the daily window ends
- **THEN** after the exit it is `used`

#### Scenario: Recurring reserved

- **WHEN** a pass is created with `type = 'entry_exit_recurring'`
- **THEN** the response has status 400 with reason `recurring_not_available`
- **THEN** the enum value and the `allowed_days`, `time_from`, `time_to` columns remain
  available for Phase 2

#### Scenario: Invalid type

- **WHEN** an unsupported type is submitted
- **THEN** the response has status 400

### Requirement: Schedule

A pass SHALL define its validity with an absolute range and an optional daily time
window evaluated in the community timezone.

#### Scenario: Valid schedule

- **WHEN** `validFrom` is before `validUntil`
- **THEN** the schedule is accepted
- **THEN** the pass is valid every day within the range

#### Scenario: Optional daily window

- **WHEN** `timeFrom` and `timeTo` are provided
- **THEN** `timeFrom` must be before `timeTo`
- **THEN** the window is evaluated in the community timezone

#### Scenario: Invalid range

- **WHEN** `validFrom` is after `validUntil` or `timeFrom` is after `timeTo`
- **THEN** the response has status 400

#### Scenario: Outside schedule

- **WHEN** the current local time of the community is outside the time window
- **THEN** entry is not authorized

#### Scenario: Reserved allowed days

- **WHEN** the MVP stores `allowedDays`
- **THEN** the value is persisted for Phase 2 but is not evaluated
- **THEN** the pass is valid every day within `validFrom`/`validUntil`

### Requirement: Vehicle

A pass SHALL be able to include a vehicle.

#### Scenario: Vehicle present

- **WHEN** `hasVehicle = true` and `vehiclePlate` is provided
- **THEN** the plate is stored normalized to uppercase
- **THEN** the guard sees the plate during the scan

#### Scenario: Vehicle without plate

- **WHEN** `hasVehicle = true` and `vehiclePlate` is missing
- **THEN** the response has status 400

### Requirement: Optional PIN

A pass SHALL be able to require a 4-digit PIN to open the public link.

#### Scenario: PIN enabled

- **WHEN** the resident sets a 4-digit PIN
- **THEN** only its hash is stored
- **THEN** the public link asks for the PIN before binding

#### Scenario: Invalid PIN length

- **WHEN** the PIN is not exactly 4 digits
- **THEN** the response has status 400

#### Scenario: PIN lockout

- **WHEN** the visitor fails the PIN `PASS_PIN_ATTEMPTS` times (5 by default)
- **THEN** further attempts are rejected for `PASS_PIN_LOCK_MINUTES` (15 by default)
- **THEN** a successful PIN resets the attempt counter

#### Scenario: Regenerate resets PIN attempts

- **WHEN** the resident regenerates the link
- **THEN** `pin_failed_attempts` and `pin_locked_until` are reset

### Requirement: Link generation

The system SHALL generate a random, unguessable link token, store only its hash, and set
an expiration.

#### Scenario: Link created

- **WHEN** a pass is created
- **THEN** a 32-byte random token is generated
- **THEN** only `link_token_hash` is persisted
- **THEN** `link_expires_at` is set to `min(now + PASS_LINK_TTL_MINUTES, validUntil)`
- **THEN** the response includes the public link once

#### Scenario: Link expired

- **WHEN** the visitor opens a link after `link_expires_at`
- **THEN** the response has status 410 with reason `link_expired`

### Requirement: Regenerate link

The resident SHALL regenerate the link if the visitor loses their device.

#### Scenario: Regenerate

- **WHEN** the resident regenerates the link of an active pass
- **THEN** a new token, hash, and `link_expires_at` are generated
- **THEN** `device_key_hash` and `bound_at` are cleared
- **THEN** the old link stops working

#### Scenario: Regenerate used or expired pass

- **WHEN** the pass is `used`, `revoked`, or `expired`
- **THEN** regeneration is rejected with status 409

### Requirement: Revoke pass

The resident or an authorized admin SHALL revoke an active pass.

#### Scenario: Revoke

- **WHEN** the pass is revoked
- **THEN** `status = 'revoked'`
- **THEN** the link and any QR token stop working

### Requirement: List and detail

The API SHALL expose the resident's passes.

#### Scenario: List own passes

- **WHEN** a resident lists their passes
- **THEN** only passes of their units are returned with status, presence state, and
  `locationPath`

#### Scenario: Pass detail

- **WHEN** a resident requests a pass they own
- **THEN** the response includes visitor data, schedule, vehicle, status, `locationPath`,
  and history
- **THEN** it does not include the raw link token or QR token

### Requirement: Issuance limits

The system SHALL rate-limit pass creation.

#### Scenario: Daily limit

- **WHEN** a unit exceeds the configured passes per day
- **THEN** further creation is rejected with status 429
