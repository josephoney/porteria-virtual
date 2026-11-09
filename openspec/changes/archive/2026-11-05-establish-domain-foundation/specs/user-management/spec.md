## ADDED Requirements

### Requirement: Manage memberships

The API SHALL provide endpoints to manage user memberships within the caller's scope.

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

#### Scenario: Deactivate membership

- **WHEN** a membership is patched to `status = 'inactive'`
- **THEN** the user can no longer obtain a token for that context
- **THEN** the user record remains active

## MODIFIED Requirements

### Requirement: List users
The API SHALL provide a `GET /api/users` endpoint accessible to `org_admin` and
`community_admin`, returning users with their memberships scoped to the caller.

#### Scenario: Org admin lists users
- **WHEN** an `org_admin` makes a GET request to `/api/users`
- **THEN** the response contains users with at least one membership in the admin's
  organization
- **THEN** each user includes their membership role and community

#### Scenario: Community admin lists users
- **WHEN** a `community_admin` makes a GET request to `/api/users`
- **THEN** only users with a membership in their community are returned

#### Scenario: Filter by community
- **WHEN** a request includes `?communityId=<uuid>`
- **THEN** only users with a membership in that community are returned
- **THEN** the community must belong to the caller's organization

#### Scenario: Non-admin cannot list users
- **WHEN** an operator makes a GET request to `/api/users`
- **THEN** the response has status 403

#### Scenario: Pagination support
- **WHEN** an admin requests `/api/users?page=1&pageSize=10`
- **THEN** the response contains `{ data: [...], total, page, pageSize }`

### Requirement: Create user
The API SHALL provide a `POST /api/users` endpoint for admins to create a global user
and an initial membership.

#### Scenario: Admin creates user with membership
- **WHEN** an `org_admin` makes a POST request with `{ email, password, name, role,
  communityId?, unitId? }`
- **THEN** a global user is created with a hashed password
- **THEN** a membership is created in the admin's organization with the given role and
  scope
- **THEN** the response has status 201 with the user and membership (without
  password_hash)

#### Scenario: Duplicate email
- **WHEN** an admin tries to create a user with an email that already exists
- **THEN** the response has status 409 with message "Email already in use"

#### Scenario: Invalid role
- **WHEN** a request includes an invalid role value
- **THEN** the response has status 400 with validation error

#### Scenario: Invalid scope for role
- **WHEN** a request creates an operational role without `communityId`
- **THEN** the response has status 400 with a scope validation error

### Requirement: Get user by ID
The API SHALL provide a `GET /api/users/:id` endpoint accessible to admins and the
user themselves, returning the user with their visible memberships.

#### Scenario: Admin views any user
- **WHEN** an admin requests a user by ID that belongs to their organization
- **THEN** the response contains the user (without password_hash) and their memberships
  within the admin's scope

#### Scenario: User views own profile
- **WHEN** a user requests their own ID
- **THEN** the response contains their profile and all their memberships

#### Scenario: User views other user
- **WHEN** a non-admin user requests another user's ID
- **THEN** the response has status 403

#### Scenario: User not found or out of scope
- **WHEN** a request is made for a non-existent user or a user outside the caller's
  organization
- **THEN** the response has status 404

### Requirement: Update user
The API SHALL provide a `PATCH /api/users/:id` endpoint for admins to update global
user details.

#### Scenario: Admin updates user
- **WHEN** an admin patches `{ name, active }` for a user in their organization
- **THEN** the user is updated
- **THEN** the response has status 200 with the updated user

#### Scenario: Cannot change email
- **WHEN** a PATCH includes an `email` field
- **THEN** the email field is ignored (email is immutable after creation)

#### Scenario: Cannot update user from another organization
- **WHEN** an admin tries to update a user with no membership in their organization
- **THEN** the response has status 404 (not found — don't leak existence)

### Requirement: Get current user profile
The API SHALL provide a `GET /api/me` endpoint for any authenticated user, returning
the user profile and membership context.

#### Scenario: Authenticated user sees their profile
- **WHEN** any authenticated user makes a GET request to `/api/me`
- **THEN** the response contains their profile (id, email, name, isPlatformAdmin,
  active) and their active membership context

#### Scenario: Unauthenticated request
- **WHEN** a request is made without a valid token
- **THEN** the response has status 401
