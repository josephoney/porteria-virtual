## MODIFIED Requirements

### Requirement: Create user
The API SHALL provide a `POST /api/users` endpoint for admins to create a global user
and an initial membership, subject to the role assignment policy.

#### Scenario: Admin creates user with membership
- **WHEN** an `org_admin` makes a POST request with `{ email, password, name, role,
  communityId?, unitId? }`
- **THEN** a global user is created with a hashed password
- **THEN** a membership is created in the admin's organization with the given role and
  scope
- **THEN** the response has status 201 with the user and membership (without
  password_hash)

#### Scenario: Platform admin creates org_admin
- **WHEN** a platform admin creates a user with `role = 'org_admin'`
- **THEN** the assignment is allowed

#### Scenario: Org admin cannot create org_admin
- **WHEN** an `org_admin` tries to create a user with `role = 'org_admin'`
- **THEN** the response has status 403

#### Scenario: Community admin cannot create org_admin or community_admin
- **WHEN** a `community_admin` tries to create a user with `role = 'org_admin'` or
  `role = 'community_admin'`
- **THEN** the response has status 403

#### Scenario: Community admin creates community role
- **WHEN** a `community_admin` creates an `operator`, `guard`, `owner`, `tenant`,
  `resident`, or `staff` in their community
- **THEN** the assignment is allowed

#### Scenario: Duplicate email
- **WHEN** an admin tries to create a user with an email that already exists
- **THEN** the response has status 409 with message "Email already in use"

#### Scenario: Invalid role
- **WHEN** a request includes an invalid role value
- **THEN** the response has status 400 with validation error

#### Scenario: Invalid scope for role
- **WHEN** a request creates an operational role without `communityId`
- **THEN** the response has status 400 with a scope validation error

### Requirement: Manage memberships
The API SHALL provide endpoints to manage user memberships within the caller's scope,
subject to the role assignment policy.

#### Scenario: Create membership
- **WHEN** an `org_admin` posts `{ userId, role, communityId?, unitId? }` for their
  organization
- **THEN** a membership is created with `status = 'active'`
- **THEN** the response has status 201 with the membership

#### Scenario: Update membership role
- **WHEN** an `org_admin` patches a membership's `role` or `status`
- **THEN** the change is persisted
- **THEN** the affected user's existing tokens for that context are rejected

#### Scenario: Community admin scope
- **WHEN** a `community_admin` creates or updates a membership
- **THEN** they can only manage memberships of their own community
- **THEN** attempts outside their community return status 403

#### Scenario: Community admin cannot escalate role
- **WHEN** a `community_admin` creates or updates a membership to `org_admin` or
  `community_admin`
- **THEN** the response has status 403

#### Scenario: Deactivate membership
- **WHEN** a membership is patched to `status = 'inactive'`
- **THEN** the user can no longer obtain a token for that context
- **THEN** the user record remains active
