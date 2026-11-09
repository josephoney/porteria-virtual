## MODIFIED Requirements

### Requirement: Create user

The API SHALL provide a `POST /api/users` endpoint for admins to create a global user
and an initial membership, subject to the role assignment policy.

#### Scenario: Admin creates user with membership
- **WHEN** an `org_admin` makes a POST request with `{ email, password, name, role,
  communityId?, locationUnitId? }`
- **THEN** a global user is created with a hashed password
- **THEN** a membership is created in the admin's organization with the given role and
  scope
- **THEN** the response has status 201 with the user and membership (without
  password_hash)

#### Scenario: Occupant requires location unit
- **WHEN** an admin creates an `owner`, `tenant` or `resident`
- **THEN** `locationUnitId` is required
- **THEN** the location must be a leaf in the selected community

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
- **THEN** the response has status 409

#### Scenario: Invalid role
- **WHEN** a request includes an invalid role value
- **THEN** the response has status 400 with validation error

#### Scenario: Invalid scope for role
- **WHEN** a request creates an operational role without `communityId`
- **THEN** the response has status 400 with a scope validation error
