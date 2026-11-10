## ADDED Requirements

### Requirement: Mobile login

The app SHALL authenticate users with email and password.

#### Scenario: Successful login

- **WHEN** the user submits valid credentials
- **THEN** the app stores the access and refresh tokens in SecureStore
- **THEN** the user proceeds to context selection or to their role home

#### Scenario: Invalid credentials

- **WHEN** the API returns 401
- **THEN** the app shows a generic invalid-credentials message

### Requirement: Context selection

The app SHALL support users with multiple memberships.

#### Scenario: Multiple memberships

- **WHEN** login returns `requiresContextSelection`
- **THEN** the app lists the memberships with role and community
- **THEN** the user selects one and calls `/api/auth/context`

#### Scenario: Single membership

- **WHEN** login returns tokens directly
- **THEN** the app enters the role home

### Requirement: Role-based home

The app SHALL show the resident or guard experience based on the active membership.

#### Scenario: Resident membership

- **WHEN** the active role is `owner`, `tenant`, or `resident`
- **THEN** the app shows the resident home

#### Scenario: Guard membership

- **WHEN** the active role is `guard`
- **THEN** the app shows the scanner as the primary screen

#### Scenario: Operator membership

- **WHEN** the active role is `operator`
- **THEN** the app shows the no-mode notice
- **THEN** the app does not show the scanner

#### Scenario: Community admin membership

- **WHEN** the active role is `community_admin`
- **THEN** the app shows a notice to use the dashboard
- **THEN** the app does not show the scanner

#### Scenario: Mixed memberships

- **WHEN** the user has both resident and guard memberships
- **THEN** the app allows switching mode from the profile/context selector

### Requirement: Session persistence

The app SHALL restore the session on launch and refresh expired tokens.

#### Scenario: Valid refresh token

- **WHEN** the app starts with a stored refresh token
- **THEN** it refreshes the session and restores the active context

#### Scenario: Invalid refresh token

- **WHEN** refresh fails
- **THEN** the app clears SecureStore and shows the login screen

### Requirement: Logout

The app SHALL revoke the refresh token and clear local state.

#### Scenario: Logout

- **WHEN** the user logs out
- **THEN** the app calls `/api/auth/logout`
- **THEN** it clears SecureStore and returns to login
