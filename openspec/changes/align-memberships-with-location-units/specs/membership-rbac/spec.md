## MODIFIED Requirements

### Requirement: Memberships table

The system SHALL have a `memberships` table linking a person to an organization, and
optionally to a community and a location unit, with a role, status, and validity window.

#### Scenario: Create membership
- **WHEN** a membership is created with `person_id`, `organization_id`, `role`, and
  optional `community_id`/`location_unit_id`
- **THEN** the row is persisted with an auto-generated UUID, `status = 'active'`, and
  timestamps

#### Scenario: Unique membership
- **WHEN** a membership is inserted with the same `(person_id, organization_id,
  community_id, location_unit_id, role)` as an existing one
- **THEN** the database rejects the insertion with a unique constraint violation
- **THEN** the comparison treats `NULL` community/location as equal (`NULLS NOT DISTINCT`)

#### Scenario: Cascade delete person
- **WHEN** a person is deleted
- **THEN** all their memberships are automatically deleted

### Requirement: Role scope rules

A membership MUST satisfy the scope required by its role.

#### Scenario: Operational role requires community
- **WHEN** a membership is created with role `community_admin`, `operator`, or
  `guard`
- **THEN** `community_id` is required
- **THEN** the insertion fails if `community_id` is null

#### Scenario: Occupant role requires location unit
- **WHEN** a membership is created with role `owner`, `tenant`, or `resident`
- **THEN** `community_id` and `location_unit_id` are required
- **THEN** the location node must be a leaf

#### Scenario: Organization admin scope
- **WHEN** a membership is created with role `org_admin`
- **THEN** `organization_id` is required and `community_id`/`location_unit_id` are
  optional
- **THEN** the role grants access to every community of the organization
