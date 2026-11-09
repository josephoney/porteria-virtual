## ADDED Requirements

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
