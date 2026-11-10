## ADDED Requirements

### Requirement: Delegation authorizer (Phase 2)

Passes SHALL record a delegated authorizer when a subuser creates the pass.

#### Scenario: Main resident authorizes

- **WHEN** the main resident creates the pass
- **THEN** `created_by_person_id` and `authorized_by_person_id` are the main person
- **THEN** `authorized_by_delegation_id` is null

#### Scenario: Subuser authorizes

- **WHEN** a subuser with `authorize_visitors` creates the pass
- **THEN** `created_by_person_id` and `authorized_by_person_id` are the subuser
- **THEN** `authorized_by_delegation_id` references the active delegation

#### Scenario: Revoked delegation

- **WHEN** the delegation is inactive at creation time
- **THEN** the request is rejected with 403

#### Scenario: MVP reserved

- **WHEN** the MVP runs
- **THEN** `authorized_by_delegation_id` is nullable and has no foreign key
- **THEN** the pass service stores null

### Requirement: Delegated creation permission

Pass creation SHALL validate location occupancy or delegation.

#### Scenario: Resident of the location

- **WHEN** the person has an active resident association with the location
- **THEN** they can create passes for it

#### Scenario: Delegated subuser

- **WHEN** the subuser is delegated for the location with `authorize_visitors`
- **THEN** they can create passes for it

#### Scenario: Unrelated user

- **WHEN** a person without association or delegation tries to create a pass
- **THEN** the request is rejected with 403

### Requirement: Scan and bitácora authorizer

The guard scan SHALL show the authorizer and the location path.

#### Scenario: Scan result

- **WHEN** a guard scans a pass
- **THEN** the response includes the structure/level path and unit code
- **THEN** it includes the authorizer name and relationship
- **THEN** it includes the delegation id when the authorizer is a subuser

#### Scenario: Bitácora

- **WHEN** a scan is recorded
- **THEN** it stores `location_unit_id`, structure snapshot, visitor, authorizer, and
  delegation ids

### Requirement: Notification recipients (Phase 2)

Notifications SHALL resolve recipients from the location.

#### Scenario: Entry notification

- **WHEN** an entry is confirmed
- **THEN** the main resident and the authorizer (if different) are notified
- **THEN** the resident is resolved from `location_residents` and accounts

#### Scenario: Missing exit

- **WHEN** a missing-exit alert is created
- **THEN** the resident(s), guard, and `community_admin` are notified

#### Scenario: MVP reserved

- **WHEN** the MVP runs
- **THEN** no notification requests are produced

### Requirement: No legacy data migration

The QR integration SHALL NOT migrate legacy pass data.

#### Scenario: No passes exist

- **WHEN** the MVP schema is created
- **THEN** there are no `access_passes` rows to migrate
- **THEN** no `unitId` compatibility alias is implemented

### Requirement: Active QR change update

The integration SHALL update the existing QR change instead of duplicating it.

#### Scenario: Part A absorbed

- **WHEN** the Slice 0 of `add-dynamic-qr-access` is applied
- **THEN** `location_unit_id`, `structure_id`, `created_by_person_id`, and
  `authorized_by_person_id` are defined there
- **THEN** this change does not duplicate those requirements

#### Scenario: Part B deferred

- **WHEN** `add-delegated-subusers` and `add-notification-service` are implemented
- **THEN** this change adds the delegation FK and notification recipients
- **THEN** no second QR change is created
