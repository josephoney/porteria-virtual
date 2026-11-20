## MODIFIED Requirements

### Requirement: Communities table

The system SHALL have a `communities` table with UUID primary key, name, slug, address,
phone, type, type label, latitude, longitude, timezone, organization reference, status,
logo reference, welcome message and timestamps. It replaces the former `locations`
table.

#### Scenario: Create community
- **WHEN** a row is inserted into `communities` with a name, address, timezone and valid
  `organization_id`
- **THEN** the row is persisted with an auto-generated UUID and timestamps
- **THEN** optional profile fields may be null

#### Scenario: Community type
- **WHEN** a community is created with `type = otro`
- **THEN** `type_label` is required

#### Scenario: Coordinates
- **WHEN** coordinates are provided
- **THEN** latitude is between -90 and 90
- **THEN** longitude is between -180 and 180

#### Scenario: Cascade delete organization
- **WHEN** an organization is deleted
- **THEN** all its communities are automatically deleted
- **THEN** buildings, units, access points and kiosks of those communities are
  automatically deleted

#### Scenario: Community status
- **WHEN** a community is created without an explicit status
- **THEN** its status defaults to `active`
- **THEN** an inactive community is excluded from operational listings
