## ADDED Requirements

### Requirement: List users
The API SHALL provide a `GET /api/users` endpoint accessible only to admin users.

#### Scenario: Admin lists users
- **WHEN** an admin makes a GET request to `/api/users`
- **THEN** the response contains a list of users belonging to the admin's organization

#### Scenario: Non-admin cannot list users
- **WHEN** an operator makes a GET request to `/api/users`
- **THEN** the response has status 403

#### Scenario: Pagination support
- **WHEN** an admin requests `/api/users?page=1&pageSize=10`
- **THEN** the response contains `{ data: [...], total, page, pageSize }`

### Requirement: Create user
The API SHALL provide a `POST /api/users` endpoint for admin to create users.

#### Scenario: Admin creates user
- **WHEN** an admin makes a POST request to `/api/users` with `{ email, password, name, role }`
- **THEN** the user is created with hashed password in the admin's organization
- **THEN** the response has status 201 with the created user (without password_hash)

#### Scenario: Duplicate email in same organization
- **WHEN** an admin tries to create a user with an email that already exists in the organization
- **THEN** the response has status 409 with message "Email already in use"

#### Scenario: Invalid role
- **WHEN** a request includes an invalid role value
- **THEN** the response has status 400 with validation error

### Requirement: Get user by ID
The API SHALL provide a `GET /api/users/:id` endpoint accessible to admin and the user themselves.

#### Scenario: Admin views any user
- **WHEN** an admin requests a user by ID from their organization
- **THEN** the response contains the full user object (without password_hash)

#### Scenario: User views own profile
- **WHEN** a user requests their own ID
- **THEN** the response contains their profile

#### Scenario: User views other user
- **WHEN** a non-admin user requests another user's ID
- **THEN** the response has status 403

#### Scenario: User not found
- **WHEN** a request is made for a non-existent user ID
- **THEN** the response has status 404

### Requirement: Update user
The API SHALL provide a `PATCH /api/users/:id` endpoint for admin to update user details.

#### Scenario: Admin updates user
- **WHEN** an admin patches `{ name, role, active }` for a user in their organization
- **THEN** the user is updated
- **THEN** the response has status 200 with the updated user

#### Scenario: Cannot change email
- **WHEN** a PATCH includes an `email` field
- **THEN** the email field is ignored (email is immutable after creation)

#### Scenario: Cannot update user from another organization
- **WHEN** an admin tries to update a user from a different organization
- **THEN** the response has status 404 (not found — don't leak existence)

### Requirement: Get current user profile
The API SHALL provide a `GET /api/me` endpoint for any authenticated user.

#### Scenario: Authenticated user sees their profile
- **WHEN** any authenticated user makes a GET request to `/api/me`
- **THEN** the response contains their full profile (id, email, name, role, organizationId, active)

#### Scenario: Unauthenticated request
- **WHEN** a request is made without a valid token
- **THEN** the response has status 401

### Requirement: Change password
The API SHALL provide a `PATCH /api/me/password` endpoint for password changes.

#### Scenario: Successful password change
- **WHEN** an authenticated user sends `{ currentPassword, newPassword }` with correct current password
- **THEN** the password is updated with a new bcrypt hash
- **THEN** the response has status 200

#### Scenario: Wrong current password
- **WHEN** the current password is incorrect
- **THEN** the response has status 401 with message "Current password is incorrect"
