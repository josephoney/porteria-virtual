## ADDED Requirements

### Requirement: Scoped administrative powers

Membership roles SHALL grant administrative powers only within their scope.

#### Scenario: Superadmin scope
- **WHEN** the active role is platform admin
- **THEN** administrative endpoints are allowed across organizations and communities

#### Scenario: Org admin scope
- **WHEN** the active role is `org_admin`
- **THEN** administrative endpoints are limited to their organization

#### Scenario: Community admin scope
- **WHEN** the active role is `community_admin`
- **THEN** administrative endpoints are limited to their community

#### Scenario: Operational role scope
- **WHEN** the active role is `operator` or `guard`
- **THEN** administrative endpoints are denied with 403

### Requirement: Permission matrix tests

The RBAC SHALL be verified by a role/scope matrix.

#### Scenario: Matrix coverage
- **WHEN** the test suite runs
- **THEN** every role is tested against organization, community, location, user, staff
  and report endpoints
- **THEN** expected 200/403/404 results are asserted
