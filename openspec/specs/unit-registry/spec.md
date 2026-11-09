# unit-registry Specification

## Purpose
TBD - created by archiving change establish-domain-foundation. Update Purpose after archive.
## Requirements
### Requirement: Units table

The system SHALL have a `units` table representing apartments, houses, offices, or
parking units inside a community.

#### Scenario: Create unit

- **WHEN** a unit is created with `community_id`, `code`, `type`, and optional
  `building_id` and `floor`
- **THEN** the row is persisted with an auto-generated UUID and timestamps

#### Scenario: Unit belongs to community

- **WHEN** a unit is created
- **THEN** its `community_id` MUST reference an existing community
- **THEN** its optional `building_id` MUST belong to the same community

#### Scenario: Unique unit code per community

- **WHEN** a unit is inserted with a `code` that already exists in the same community
- **THEN** the database rejects the insertion with a unique constraint violation

#### Scenario: Unit types

- **WHEN** a unit is created with type `apartment`, `house`, `office`, `parking`, or
  `storage`
- **THEN** the value is accepted
- **THEN** any other type is rejected

### Requirement: Unit status

Units SHALL have a lifecycle status.

#### Scenario: Default status

- **WHEN** a unit is created without an explicit status
- **THEN** its status defaults to `active`

#### Scenario: Inactive unit excluded from operational listings

- **WHEN** a unit has status `inactive`
- **THEN** it is excluded from resident-facing and access listings
- **THEN** its historical records remain queryable for audit

### Requirement: Unit occupancy through memberships

Occupancy SHALL be expressed with memberships that reference the unit and carry the
role `owner`, `tenant`, or `resident`.

#### Scenario: Owner membership

- **WHEN** an `owner` membership is created for a unit
- **THEN** the user is linked to that unit as owner
- **THEN** the membership is visible in the unit's occupancy list

#### Scenario: Tenant membership

- **WHEN** a `tenant` membership is created for a unit
- **THEN** the user is linked to that unit as tenant
- **THEN** the unit can have one active tenant at a time

#### Scenario: Multiple residents per unit

- **WHEN** several `resident` memberships reference the same unit
- **THEN** all of them are allowed
- **THEN** each membership grants unit-scoped access to its user

### Requirement: Unit listing

The API SHALL expose community-scoped unit listings.

#### Scenario: List units of a community

- **WHEN** an `org_admin` or `community_admin` requests units of a community
- **THEN** the response contains the units with `id`, `code`, `type`, `floor`,
  `buildingName`, and `status`

#### Scenario: Resident lists own units

- **WHEN** a resident requests their units
- **THEN** only units referenced by their active memberships are returned

#### Scenario: Cross-tenant unit access

- **WHEN** a user requests units of a community in another organization
- **THEN** the response has status 404

