## ADDED Requirements

### Requirement: Organization as tenant

The system SHALL treat each `organization` as an isolated tenant. Every tenant-owned
record MUST belong to exactly one organization, directly or through its community.

#### Scenario: Organization owns communities

- **WHEN** a community is created with a valid `organization_id`
- **THEN** the community is scoped to that organization
- **THEN** no user from another organization can read or mutate it

#### Scenario: Tenant isolation on queries

- **WHEN** any authenticated request lists tenant-owned data
- **THEN** the query is filtered by the active organization from the JWT
- **THEN** rows belonging to other organizations are never returned

### Requirement: Communities table

The system SHALL have a `communities` table with UUID primary key, name, address,
timezone, organization reference, status, and timestamps. It replaces the former
`locations` table.

#### Scenario: Create community

- **WHEN** a row is inserted into `communities` with a name, address, timezone, and
  valid `organization_id`
- **THEN** the row is persisted with an auto-generated UUID and timestamps

#### Scenario: Cascade delete organization

- **WHEN** an organization is deleted
- **THEN** all its communities are automatically deleted
- **THEN** buildings, units, access points and kiosks of those communities are
  automatically deleted

#### Scenario: Community status

- **WHEN** a community is created without an explicit status
- **THEN** its status defaults to `active`
- **THEN** an inactive community is excluded from operational listings

### Requirement: Buildings table

The system SHALL have a `buildings` table representing towers or blocks inside a
community. A community MAY have zero or more buildings.

#### Scenario: Create building

- **WHEN** a building is created with `community_id`, `name`, and optional `code`
- **THEN** the building is persisted and linked to that community

#### Scenario: Community without buildings

- **WHEN** a community has no buildings
- **THEN** its units can still be created with `building_id = NULL`

#### Scenario: Cascade delete community

- **WHEN** a community is deleted
- **THEN** all its buildings are automatically deleted

### Requirement: Community-scoped access points

Access points MUST belong to a community, not to a free-form location.

#### Scenario: Access point belongs to community

- **WHEN** an access point is created with a valid `community_id`
- **THEN** it is scoped to that community

#### Scenario: Cross-tenant access point rejected

- **WHEN** a request tries to create an access point in a community of another
  organization
- **THEN** the request is rejected with status 403

### Requirement: Optional community filter on listings

Tenant-scoped listing endpoints SHALL accept an optional `communityId` query
parameter.

#### Scenario: Filter by community

- **WHEN** an authenticated user requests a listing with `?communityId=<uuid>`
- **THEN** only records of that community are returned
- **THEN** the community must belong to the user's active organization

#### Scenario: Invalid community filter

- **WHEN** the `communityId` does not belong to the active organization
- **THEN** the response has status 404
