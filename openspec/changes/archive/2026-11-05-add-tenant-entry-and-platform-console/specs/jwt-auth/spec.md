## MODIFIED Requirements

### Requirement: Login endpoint
The API SHALL provide a `POST /api/auth/login` endpoint that validates email and
password and returns JWT tokens bound to an active membership context, optionally
scoped to a community by `communitySlug`.

#### Scenario: Successful login without communitySlug
- **WHEN** a POST request is made to `/api/auth/login` with valid `{ email, password }`
  and the user has exactly one active membership
- **THEN** the response has status 200 with `{ accessToken, refreshToken, user: { id,
  email, name, isPlatformAdmin }, activeMembership: { id, role, organizationId,
  communityId, unitId } }`

#### Scenario: Multiple memberships without communitySlug
- **WHEN** the user has more than one active membership and no `communitySlug` is sent
- **THEN** the response has status 200 with `{ requiresContextSelection: true,
  memberships: [...] }` and no tokens
- **THEN** the client must call `POST /api/auth/context` to obtain tokens

#### Scenario: Single membership in the scoped community
- **WHEN** the request includes a valid `communitySlug` and the user has exactly one
  active membership in that community
- **THEN** the response has status 200 with tokens and that membership as the active
  context
- **THEN** memberships in other communities are not returned

#### Scenario: Multiple memberships in the scoped community
- **WHEN** the request includes a valid `communitySlug` and the user has more than one
  active membership in that community
- **THEN** the response has status 200 with `{ requiresContextSelection: true,
  memberships: [...] }` containing only memberships of that community
- **THEN** the client must call `POST /api/auth/context`

#### Scenario: No membership in the scoped community
- **WHEN** the request includes a valid `communitySlug` and the user has no active
  membership in that community
- **THEN** the response has status 403
- **THEN** the response does not reveal memberships in other communities

#### Scenario: Unknown or inactive community slug
- **WHEN** the request includes a `communitySlug` that does not resolve to an active
  community
- **THEN** the response has status 404

#### Scenario: Platform admin with communitySlug
- **WHEN** the user has `is_platform_admin = true` and includes a `communitySlug`
- **THEN** the response has status 200 with tokens and the platform context
- **THEN** the platform context is not restricted to the community

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
