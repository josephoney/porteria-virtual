## ADDED Requirements

### Requirement: Context switch endpoint

The API SHALL provide `POST /api/auth/context` to switch the active membership context.

#### Scenario: Switch to owned active membership

- **WHEN** an authenticated user posts `{ membershipId }` for an active membership they
  own
- **THEN** the response has status 200 with a new `{ accessToken, refreshToken,
  user, activeMembership }`
- **THEN** the previously active refresh token is revoked

#### Scenario: Switch to foreign or inactive membership

- **WHEN** the `membershipId` does not belong to the user or is inactive
- **THEN** the response has status 404

#### Scenario: Unauthenticated context switch

- **WHEN** the request has no valid access token
- **THEN** the response has status 401

## MODIFIED Requirements

### Requirement: Login endpoint
The API SHALL provide a `POST /api/auth/login` endpoint that validates email and
password and returns JWT tokens bound to an active membership context.

#### Scenario: Successful login with a single membership
- **WHEN** a POST request is made to `/api/auth/login` with valid `{ email, password }`
  and the user has exactly one active membership
- **THEN** the response has status 200 with `{ accessToken, refreshToken, user: { id,
  email, name, isPlatformAdmin }, activeMembership: { id, role, organizationId,
  communityId, unitId } }`

#### Scenario: Successful login with multiple memberships
- **WHEN** the user has more than one active membership
- **THEN** the response has status 200 with `{ requiresContextSelection: true,
  memberships: [...] }` and no tokens
- **THEN** the client must call `POST /api/auth/context` to obtain tokens

#### Scenario: Successful login as platform admin
- **WHEN** the user has `is_platform_admin = true`
- **THEN** the response has status 200 with tokens and a platform context
- **THEN** no tenant membership is required

#### Scenario: Invalid credentials
- **WHEN** a POST request is made with incorrect password
- **THEN** the response has status 401 with `{ statusCode: 401, error: "Unauthorized",
  message: "Invalid email or password" }`

#### Scenario: Inactive user
- **WHEN** a user with `active = false` attempts login
- **THEN** the response has status 401 regardless of correct credentials

#### Scenario: Access token contains membership context
- **WHEN** a login is successful
- **THEN** the access token payload contains `{ sub, email, orgId, membershipId, role,
  communityId?, unitId?, isPlatformAdmin }` signed with JWT_SECRET
- **THEN** the access token expires in 15 minutes

### Requirement: Authentication middleware
The API SHALL have a Fastify plugin that validates JWT access tokens on protected
routes and exposes the active membership context.

#### Scenario: Valid token
- **WHEN** a request includes `Authorization: Bearer <valid-token>`
- **THEN** the request proceeds to the route handler
- **THEN** `request.user` is populated with `{ userId, email, orgId, membershipId,
  role, communityId, unitId, isPlatformAdmin }`

#### Scenario: Missing token
- **WHEN** a request to a protected route has no Authorization header
- **THEN** the response has status 401

#### Scenario: Expired token
- **WHEN** a request includes an expired access token
- **THEN** the response has status 401 with message "Token expired"

#### Scenario: Invalid token
- **WHEN** a request includes a malformed or tampered token
- **THEN** the response has status 401

#### Scenario: Inactive membership in token
- **WHEN** the token references a membership that is now inactive
- **THEN** the response has status 401
- **THEN** the client must re-authenticate

### Requirement: RBAC middleware
The API SHALL have a middleware that restricts route access using the active
membership role and scope.

#### Scenario: Org admin accesses admin route
- **WHEN** a user with active role `org_admin` accesses a route protected with
  `requireRole('org_admin')`
- **THEN** the request proceeds normally

#### Scenario: Operator accesses admin route
- **WHEN** a user with active role `operator` accesses a route protected with
  `requireRole('org_admin')`
- **THEN** the response has status 403 with message "Insufficient permissions"

#### Scenario: Multiple roles allowed
- **WHEN** a route is protected with `requireRole('org_admin', 'community_admin',
  'operator')`
- **THEN** users with any of those active roles can access it
- **THEN** guard and resident users receive 403

#### Scenario: Platform admin bypass
- **WHEN** a platform admin with an active context accesses a tenant route
- **THEN** the request proceeds
