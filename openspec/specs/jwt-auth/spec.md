## Purpose

Authentication and authorization: JWT access/refresh tokens, active membership context and role-based access control.
## Requirements
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

### Requirement: Refresh token endpoint
The API SHALL provide a `POST /api/auth/refresh` endpoint that rotates refresh tokens.

#### Scenario: Valid refresh
- **WHEN** a POST request is made with a valid refresh token
- **THEN** the old refresh token is revoked in the database
- **THEN** the response contains a new `{ accessToken, refreshToken }` pair

#### Scenario: Revoked refresh token
- **WHEN** a POST request is made with a revoked refresh token
- **THEN** the response has status 401

#### Scenario: Expired refresh token
- **WHEN** a POST request is made with an expired refresh token
- **THEN** the response has status 401

### Requirement: Logout endpoint
The API SHALL provide a `POST /api/auth/logout` endpoint that revokes the refresh token.

#### Scenario: Successful logout
- **WHEN** an authenticated user makes a POST request to `/api/auth/logout` with their refresh token
- **THEN** the refresh token is marked as revoked in the database
- **THEN** the response has status 200 with `{ message: "Logged out" }`

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

### Requirement: Client-side token persistence
The client SHALL persist the authentication tokens and user data to localStorage upon successful login.

#### Scenario: Successful login persists tokens
- **WHEN** a login request succeeds with `{ accessToken, refreshToken, user }`
- **THEN** `localStorage.setItem('auth_access_token', accessToken)` is called
- **THEN** `localStorage.setItem('auth_refresh_token', refreshToken)` is called
- **THEN** `localStorage.setItem('auth_user', JSON.stringify(user))` is called
- **THEN** React state `token` and `user` are set

#### Scenario: Refresh token is stored for later use
- **WHEN** login succeeds
- **THEN** the refresh token is available via `localStorage.getItem('auth_refresh_token')`
- **THEN** subsequent API calls that receive 401 can use it to obtain a new access token

### Requirement: Session recovery on page reload
The client SHALL attempt to recover the authenticated session from localStorage when the application initializes.

#### Scenario: Valid refresh token on init
- **WHEN** the AuthProvider mounts and `localStorage` contains `auth_refresh_token`
- **THEN** a POST request is made to `/api/auth/refresh` with the stored refresh token
- **THEN** if the response is successful, the new `accessToken` and `refreshToken` are stored in localStorage and React state
- **THEN** the user from `auth_user` is restored to React state
- **THEN** `isLoading` transitions from `true` to `false`

#### Scenario: Expired or revoked refresh token on init
- **WHEN** the refresh request fails (401)
- **THEN** all auth keys are removed from localStorage
- **THEN** React state remains empty (token = null, user = null)
- **THEN** `isLoading` transitions to `false`
- **THEN** `RequireAuth` redirects to `/login`

#### Scenario: No stored tokens on init
- **WHEN** localStorage contains no auth keys
- **THEN** `isLoading` immediately transitions to `false`
- **THEN** `RequireAuth` redirects to `/login`

#### Scenario: Loading state blocks premature redirect
- **WHEN** AuthProvider is initializing (isLoading = true)
- **THEN** `RequireAuth` does NOT redirect to `/login`
- **THEN** `RequireAuth` renders a loading indicator or null

### Requirement: Client-side logout
The client SHALL revoke the refresh token server-side on logout and clear all persisted auth state.

#### Scenario: Successful logout
- **WHEN** an authenticated user triggers logout
- **THEN** a POST request is made to `/api/auth/logout` with the stored refresh token
- **THEN** `localStorage.removeItem()` is called for all auth keys
- **THEN** React state `token` and `user` are set to `null`
- **THEN** the user is redirected to `/login`

#### Scenario: Logout handles network failure gracefully
- **WHEN** the POST to `/api/auth/logout` fails (network error)
- **THEN** localStorage is STILL cleared
- **THEN** React state is STILL cleared
- **THEN** the user is still redirected to `/login`

### Requirement: Automatic token refresh on 401
The client SHALL automatically attempt to refresh the access token when an authenticated API request returns 401.

#### Scenario: Single 401 triggers refresh and retry
- **WHEN** an authenticated API request receives a 401 response
- **THEN** a POST request is made to `/api/auth/refresh` with the stored refresh token
- **THEN** if refresh succeeds, the new tokens are stored in localStorage and React state
- **THEN** the original failed request is retried with the new access token
- **THEN** the retry response is returned to the caller

#### Scenario: Concurrent 401s share a single refresh
- **WHEN** multiple API requests receive 401 simultaneously
- **THEN** only ONE POST to `/api/auth/refresh` is made
- **THEN** all other requests await the same refresh promise
- **THEN** after successful refresh, all requests retry with the new token

#### Scenario: Refresh failure triggers logout
- **WHEN** a 401-triggered refresh request also fails (401)
- **THEN** `logout()` is called (clear localStorage, clear state, revoke server-side)
- **THEN** the user is redirected to `/login`

### Requirement: Centralized API client
The dashboard SHALL have a centralized HTTP client module that all authenticated API calls use.

#### Scenario: apiClient attaches auth header
- **WHEN** `apiClient.get()` or `apiClient.post()` or `apiClient.patch()` is called
- **THEN** the request includes `Authorization: Bearer <accessToken>` header
- **THEN** the request includes `Content-Type: application/json` header for POST/PATCH

#### Scenario: apiClient handles 401 with refresh
- **WHEN** an apiClient request receives 401
- **THEN** it automatically attempts token refresh and retries the request
- **THEN** the caller receives the retry response without knowing about the refresh

#### Scenario: apiClient throws on non-401 errors
- **WHEN** an apiClient request receives an HTTP error that is not 401
- **THEN** an error is thrown with the response status and body

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

