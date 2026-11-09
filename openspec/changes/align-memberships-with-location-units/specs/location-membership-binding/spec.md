## ADDED Requirements

### Requirement: Membership location unit

Memberships for occupants SHALL reference a location leaf.

#### Scenario: Resident membership
- **WHEN** a membership is created for `owner`, `tenant` or `resident`
- **THEN** `location_unit_id` is required
- **THEN** the referenced node belongs to the membership community

#### Scenario: Staff membership
- **WHEN** a membership is created for `community_admin`, `operator` or `guard`
- **THEN** `community_id` is required
- **THEN** `location_unit_id` may be null

#### Scenario: Organization membership
- **WHEN** a membership is created for `org_admin`
- **THEN** `organization_id` is required
- **THEN** `community_id` and `location_unit_id` may be null

#### Scenario: Leaf validation
- **WHEN** `location_unit_id` points to a section, floor or intermediate node
- **THEN** the request is rejected with status 400

#### Scenario: Cross-community unit
- **WHEN** `location_unit_id` belongs to another community
- **THEN** the response has status 404

### Requirement: Invitation location unit

Occupant invitations SHALL reference a location leaf.

#### Scenario: Resident invitation
- **WHEN** a `resident` invitation is created
- **THEN** `location_unit_id` is required
- **THEN** the invitation includes the corresponding community

#### Scenario: Invitation preview
- **WHEN** a valid invitation is previewed
- **THEN** the response includes the community and location path/code

#### Scenario: Accept invitation
- **WHEN** a resident invitation is accepted
- **THEN** the membership is created with the same `location_unit_id`

#### Scenario: Non-occupant invitation
- **WHEN** an `org_admin` or `community_admin` invitation is created
- **THEN** `location_unit_id` is null

### Requirement: Legacy compatibility and migration

The system SHALL migrate legacy unit references without losing residents.

#### Scenario: Backfill
- **WHEN** the migration runs
- **THEN** legacy `units.id` references are mapped to `location_units.id`
- **THEN** resolved memberships/invitations keep their scope

#### Scenario: Unresolved reference
- **WHEN** a legacy unit cannot be mapped
- **THEN** the migration records it in a review report
- **THEN** it does not silently assign a different unit

#### Scenario: Compatibility input
- **WHEN** a legacy client sends `unitId`
- **THEN** it is mapped only when unambiguous
- **THEN** the deprecation is reported without persisting an invalid reference

#### Scenario: Rollback
- **WHEN** the migration is rolled back
- **THEN** the legacy references and resident counts are restored

### Requirement: Location assignment audit

Membership and invitation location changes SHALL be audited.

#### Scenario: Membership location changed
- **WHEN** an admin moves a resident membership to another leaf
- **THEN** an event records actor, old unit, new unit and community

#### Scenario: Invitation created
- **WHEN** a resident invitation is created
- **THEN** an event records the location unit and invited email
