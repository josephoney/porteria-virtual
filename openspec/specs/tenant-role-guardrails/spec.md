# tenant-role-guardrails Specification

## Purpose
TBD - created by archiving change fix-critical-security-and-tenant. Update Purpose after archive.
## Requirements
### Requirement: Resident dashboard routing

The dashboard SHALL prevent residents from entering operator screens.

#### Scenario: Resident login
- **WHEN** a user with only resident memberships logs into the dashboard
- **THEN** the app redirects to a “use the Zima app” screen or the resident home
- **THEN** `/` and `/admin` are not rendered

#### Scenario: Direct navigation
- **WHEN** a resident opens `/` or `/admin` directly
- **THEN** the app redirects to the allowed screen

### Requirement: Operator socket only for operational roles

The dashboard SHALL open an operator socket only for operational roles.

#### Scenario: Operational role
- **WHEN** the active role is `operator`, `guard`, `community_admin`, or `org_admin`
- **THEN** the app connects the operator socket

#### Scenario: Resident role
- **WHEN** the active role is `owner`, `tenant`, or `resident`
- **THEN** the app does not connect the operator socket

#### Scenario: Platform context
- **WHEN** the active context is platform
- **THEN** the app does not connect the operator socket

### Requirement: Call scope by role

Call listings SHALL respect the role scope.

#### Scenario: Operator
- **WHEN** an operator lists calls
- **THEN** only calls where they are the operator are returned

#### Scenario: Community admin
- **WHEN** a community_admin lists calls
- **THEN** calls of their community are returned
- **THEN** they are not restricted to calls they personally handled

#### Scenario: Org admin
- **WHEN** an org_admin lists calls
- **THEN** calls of their organization are returned

#### Scenario: Platform context
- **WHEN** a platform admin lists calls without tenant context
- **THEN** the response is 403 with a “select a community” message

### Requirement: Role options in the UI

The user creation form SHALL hide roles the requester cannot assign.

#### Scenario: Community admin form
- **WHEN** a community_admin opens the create-user form
- **THEN** `org_admin` is not offered
- **THEN** only roles allowed in their community are offered

#### Scenario: Org admin form
- **WHEN** an org_admin opens the form
- **THEN** `org_admin` is not offered unless they are allowed to delegate it
- **THEN** community-scoped roles are offered

#### Scenario: Platform admin form
- **WHEN** a platform admin invites an `org_admin`
- **THEN** the option is available

