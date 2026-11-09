# membership-rbac Specification

## Purpose
TBD - created by archiving change establish-domain-foundation. Update Purpose after archive.
## Requirements
### Requirement: Memberships table

The system SHALL have a `memberships` table linking a user to an organization, and
optionally to a community and a unit, with a role, status, and validity window.

#### Scenario: Create membership

- **WHEN** a membership is created with `user_id`, `organization_id`, `role`, and
  optional `community_id`/`unit_id`
- **THEN** the row is persisted with an auto-generated UUID, `status = 'active'`, and
  timestamps

#### Scenario: Unique membership

- **WHEN** a membership is inserted with the same `(user_id, organization_id,
  community_id, unit_id, role)` as an existing one
- **THEN** the database rejects the insertion with a unique constraint violation
- **THEN** the comparison treats `NULL` community/unit as equal (`NULLS NOT DISTINCT`)

#### Scenario: Cascade delete user

- **WHEN** a user is deleted
- **THEN** all their memberships are automatically deleted

### Requirement: Scoped roles

Membership roles SHALL be `org_admin`, `community_admin`, `operator`, `guard`,
`owner`, `tenant`, `resident`, and `staff`. Platform-level administration SHALL be
represented by `users.is_platform_admin`, not by a membership role.

#### Scenario: Valid role accepted

- **WHEN** a membership is created with `role = 'community_admin'`
- **THEN** the value is persisted

#### Scenario: Invalid role rejected

- **WHEN** a membership is created with a role outside the allowed set
- **THEN** the database rejects the insertion

#### Scenario: Platform admin has no membership requirement

- **WHEN** a user has `is_platform_admin = true`
- **THEN** they can access platform-level endpoints without a tenant membership
- **THEN** tenant endpoints still require an active membership context

### Requirement: Role scope rules

A membership MUST satisfy the scope required by its role.

#### Scenario: Operational role requires community

- **WHEN** a membership is created with role `community_admin`, `operator`, or
  `guard`
- **THEN** `community_id` is required
- **THEN** the insertion fails if `community_id` is null

#### Scenario: Occupant role requires unit

- **WHEN** a membership is created with role `owner`, `tenant`, or `resident`
- **THEN** `community_id` and `unit_id` are required

#### Scenario: Organization admin scope

- **WHEN** a membership is created with role `org_admin`
- **THEN** `organization_id` is required and `community_id` is optional
- **THEN** the role grants access to every community of the organization

### Requirement: Active membership context

An authenticated request MUST operate within a single active membership context.

#### Scenario: Single membership auto-selected

- **WHEN** a user with exactly one active membership logs in
- **THEN** the login response includes that membership as the active context

#### Scenario: Multiple memberships require selection

- **WHEN** a user with more than one active membership logs in
- **THEN** the login response includes the list of memberships
- **THEN** no access token is issued until a membership is selected

#### Scenario: Switch active context

- **WHEN** an authenticated user calls `POST /api/auth/context` with a `membershipId`
  they own and that is active
- **THEN** a new access token and refresh token are issued for that context
- **THEN** the previous refresh token is revoked

#### Scenario: Switch to foreign membership

- **WHEN** a user requests a context for a membership that does not belong to them
- **THEN** the response has status 404

### Requirement: Scope-based authorization

The RBAC middleware SHALL authorize requests using the role and scope of the active
membership, not a global user role.

#### Scenario: Org admin accesses community resource

- **WHEN** an `org_admin` accesses a resource of any community in their organization
- **THEN** the request proceeds

#### Scenario: Community admin restricted to own community

- **WHEN** a `community_admin` of community A accesses a resource of community B
- **THEN** the response has status 403

#### Scenario: Guard restricted to assigned community

- **WHEN** a `guard` accesses a route protected for operators
- **THEN** the response has status 403

#### Scenario: Platform admin bypass

- **WHEN** a `super_admin` accesses a tenant endpoint with a valid active context
- **THEN** the request proceeds regardless of membership role

### Requirement: Membership deactivation

Memberships SHALL be deactivatable without deleting the user.

#### Scenario: Deactivate membership

- **WHEN** an admin sets a membership `status = 'inactive'`
- **THEN** the user can no longer obtain a token for that context
- **THEN** existing access tokens for that context are rejected on the next request

#### Scenario: Inactive membership excluded from login

- **WHEN** a user logs in
- **THEN** only active memberships are returned for context selection

### Requirement: Role assignment policy

The system SHALL centralize who can assign each membership role.

#### Scenario: Platform admin assigns org_admin
- **WHEN** a platform admin creates or invites an `org_admin`
- **THEN** the assignment is allowed

#### Scenario: Org admin assigns community roles
- **WHEN** an `org_admin` creates a `community_admin`, `operator`, `guard`, or resident
  role in their organization
- **THEN** the assignment is allowed

#### Scenario: Community admin assigns community roles
- **WHEN** a `community_admin` creates an `operator`, `guard`, or resident role in their
  community
- **THEN** the assignment is allowed
- **THEN** assigning `org_admin` is rejected with 403

#### Scenario: No self-escalation
- **WHEN** a user tries to assign themselves a role higher than their current role
- **THEN** the assignment is rejected

#### Scenario: Scope mismatch
- **WHEN** a role is assigned outside the requester's organization or community
- **THEN** the assignment is rejected with 403/404

