## MODIFIED Requirements

### Requirement: Community management

Platform administrators SHALL read communities; community writes SHALL be performed by
organization administrators.

#### Scenario: List communities
- **WHEN** a platform admin lists communities with optional `organizationId`
- **THEN** the response is paginated and includes organization name and slug

#### Scenario: Read community
- **WHEN** a platform admin opens a community
- **THEN** the profile and hierarchy are visible

#### Scenario: No community write
- **WHEN** a platform admin tries to create, update or delete a community
- **THEN** the response has status 403

### Requirement: Building management

Platform administrators SHALL read buildings/sections; location writes SHALL be
performed by organization or community administrators.

#### Scenario: List buildings
- **WHEN** buildings are listed by community
- **THEN** the response includes id, name, code, floors and unit count

#### Scenario: No building write
- **WHEN** a platform admin tries to create or update a building/section
- **THEN** the response has status 403

### Requirement: Unit management

Platform administrators SHALL read units; unit writes SHALL be performed by organization
or community administrators.

#### Scenario: List units
- **WHEN** units are listed with optional `communityId` and `buildingId`
- **THEN** the response is paginated with code, type, floor, building and status

#### Scenario: No unit write
- **WHEN** a platform admin tries to create or update a unit
- **THEN** the response has status 403
