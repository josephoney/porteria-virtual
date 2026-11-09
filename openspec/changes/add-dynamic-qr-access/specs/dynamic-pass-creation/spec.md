## ADDED Requirements

### Requirement: Create access pass

The API SHALL let a resident create an access pass for a unit they belong to.

#### Scenario: Resident creates a pass
- **WHEN** an authenticated resident creates a pass for their unit
- **THEN** the pass is created with `status = 'active'` and a generated self-service link
- **THEN** the response includes the pass id and the share link

#### Scenario: Required visitor fields
- **WHEN** a pass is created
- **THEN** it requires `communityId`, `unitId`, `visitorFirstName`, `visitorLastName`,
  `visitorDocument`, `type`, `validFrom`, `validUntil`, and a daily time window

#### Scenario: Resident outside own unit
- **WHEN** a resident tries to create a pass for another unit
- **THEN** the response has status 403

#### Scenario: Cross-tenant attempt
- **WHEN** a user creates a pass in another organization
- **THEN** the response has status 404

### Requirement: Pass types

The system SHALL support `entry_only`, `entry_exit`, and `entry_exit_recurring`.

#### Scenario: Entry only
- **WHEN** a pass is created with `type = 'entry_only'`
- **THEN** it allows a single confirmed entry and is then `used`

#### Scenario: Entry and exit
- **WHEN** a pass is created with `type = 'entry_exit'`
- **THEN** it allows one entry and one exit within the validity window
- **THEN** after the exit it is `used`

#### Scenario: Recurring entry and exit
- **WHEN** a pass is created with `type = 'entry_exit_recurring'`
- **THEN** it allows repeated entry/exit cycles on the allowed days and time window
- **THEN** after an exit it remains `active` until `validUntil`

#### Scenario: Invalid type
- **WHEN** an unsupported type is submitted
- **THEN** the response has status 400

### Requirement: Schedule

A pass SHALL define its validity with an absolute range, allowed days, and a daily time
window evaluated in the community timezone.

#### Scenario: Valid schedule
- **WHEN** `validFrom` is before `validUntil`, allowed days are a subset of Monday–Sunday,
  and `timeFrom` is before `timeTo`
- **THEN** the schedule is accepted

#### Scenario: Invalid range
- **WHEN** `validFrom` is after `validUntil` or `timeFrom` is after `timeTo`
- **THEN** the response has status 400

#### Scenario: Outside schedule
- **WHEN** the current local time of the community is outside the allowed days or time
  window
- **THEN** entry is not authorized

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

### Requirement: Link generation

The system SHALL generate a random, unguessable link token and store only its hash.

#### Scenario: Link created
- **WHEN** a pass is created
- **THEN** a 32-byte random token is generated
- **THEN** only `link_token_hash` is persisted
- **THEN** the response includes the public link once

### Requirement: Regenerate link

The resident SHALL regenerate the link if the visitor loses their device.

#### Scenario: Regenerate
- **WHEN** the resident regenerates the link of an active pass
- **THEN** a new token and hash are generated
- **THEN** the previous device binding is cleared
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
- **THEN** only passes of their units are returned with status and presence state

#### Scenario: Pass detail
- **WHEN** a resident requests a pass they own
- **THEN** the response includes visitor data, schedule, vehicle, status, and history
- **THEN** it does not include the raw link token or QR token

### Requirement: Issuance limits

The system SHALL rate-limit pass creation.

#### Scenario: Daily limit
- **WHEN** a unit exceeds the configured passes per day
- **THEN** further creation is rejected with status 429
