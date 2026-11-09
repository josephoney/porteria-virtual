## ADDED Requirements

### Requirement: Pass location reference

Every pass SHALL reference a leaf location unit.

#### Scenario: Create pass with location
- **WHEN** a resident creates a pass
- **THEN** the pass stores `location_unit_id`, `community_id` and `structure_id`
- **THEN** the location must be a leaf (`level_position = level_count`)

#### Scenario: Non-leaf location
- **WHEN** a pass references an internal node
- **THEN** the request is rejected with 400

#### Scenario: Cross-tenant location
- **WHEN** the location belongs to another community/organization
- **THEN** the request is rejected with 403/404

### Requirement: Authorizer identity

Passes SHALL record the person who authorized them.

#### Scenario: Main user authorizes
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

### Requirement: Creation permission

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

### Requirement: Scan and bitácora location

The guard scan SHALL show the location path and authorizer.

#### Scenario: Scan result
- **WHEN** a guard scans a pass
- **THEN** the response includes the structure/level path and unit code
- **THEN** it includes the authorizer name and relationship

#### Scenario: Bitácora
- **WHEN** a scan is recorded
- **THEN** it stores `location_unit_id`, structure snapshot, visitor and authorizer ids

### Requirement: Notification recipients

Notifications SHALL resolve recipients from the location.

#### Scenario: Entry notification
- **WHEN** an entry is confirmed
- **THEN** the main resident and the authorizer (if different) are notified
- **THEN** the resident is resolved from `location_residents` and accounts

#### Scenario: Missing exit
- **WHEN** a missing-exit alert is created
- **THEN** the resident(s), guard and `community_admin` are notified

### Requirement: Migration and compatibility

The QR integration SHALL not break existing passes.

#### Scenario: Legacy pass migration
- **WHEN** a pass has a legacy `unit_id`
- **THEN** it is mapped to `location_unit_id`
- **THEN** unmapped passes are reported and quarantined

#### Scenario: Temporary alias
- **WHEN** a client still sends `unitId`
- **THEN** the API normalizes it to `locationUnitId`
- **THEN** the new DTO always returns `locationUnitId`

#### Scenario: Regression
- **WHEN** the existing QR flow runs after the migration
- **THEN** creation, scan, confirm/reject and notifications keep working

### Requirement: Active QR change update

The integration SHALL update the existing QR change instead of duplicating it.

#### Scenario: Update artifacts
- **WHEN** this change is implemented
- **THEN** `add-dynamic-qr-access` proposal/design/specs/tasks are updated with the new
  location/authorizer fields
- **THEN** no second QR change is created
