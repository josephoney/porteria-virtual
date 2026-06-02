## ADDED Requirements

### Requirement: Login endpoint
The API SHALL provide a `POST /api/auth/login` endpoint that validates email and password and returns JWT tokens.

#### Scenario: Successful login
- **WHEN** a POST request is made to `/api/auth/login` with valid `{ email, password }`
- **THEN** the response has status 200 with `{ accessToken, refreshToken, user: { id, email, name, role, organizationId } }`

#### Scenario: Invalid credentials
- **WHEN** a POST request is made with incorrect password
- **THEN** the response has status 401 with `{ statusCode: 401, error: "Unauthorized", message: "Invalid email or password" }`

#### Scenario: Inactive user
- **WHEN** a user with `active = false` attempts login
- **THEN** the response has status 401 regardless of correct credentials

#### Scenario: Access token contains user claims
- **WHEN** a login is successful
- **THEN** the access token payload contains `{ sub: userId, email, role, orgId }` signed with JWT_SECRET
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
The API SHALL have a Fastify plugin that validates JWT access tokens on protected routes.

#### Scenario: Valid token
- **WHEN** a request includes `Authorization: Bearer <valid-token>`
- **THEN** the request proceeds to the route handler
- **THEN** `request.user` is populated with `{ userId, email, role, orgId }`

#### Scenario: Missing token
- **WHEN** a request to a protected route has no Authorization header
- **THEN** the response has status 401

#### Scenario: Expired token
- **WHEN** a request includes an expired access token
- **THEN** the response has status 401 with message "Token expired"

#### Scenario: Invalid token
- **WHEN** a request includes a malformed or tampered token
- **THEN** the response has status 401

### Requirement: RBAC middleware
The API SHALL have a middleware that restricts route access by user role.

#### Scenario: Admin accesses admin route
- **WHEN** a user with role `admin` accesses a route protected with `requireRole('admin')`
- **THEN** the request proceeds normally

#### Scenario: Operator accesses admin route
- **WHEN** a user with role `operator` accesses a route protected with `requireRole('admin')`
- **THEN** the response has status 403 with message "Insufficient permissions"

#### Scenario: Multiple roles allowed
- **WHEN** a route is protected with `requireRole('admin', 'operator')`
- **THEN** both admin and operator users can access it
- **THEN** guard and resident users receive 403
