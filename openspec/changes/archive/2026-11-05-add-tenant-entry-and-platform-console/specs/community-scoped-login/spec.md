## ADDED Requirements

### Requirement: Community entry route

The dashboard SHALL expose a public route `/c/:slug` for community-scoped entry.

#### Scenario: Valid slug renders branding
- **WHEN** a visitor opens `/c/torre-norte`
- **THEN** the app resolves the community by slug and shows its name, address, and
  organization
- **THEN** the login form is rendered in the community context

#### Scenario: Unknown slug
- **WHEN** a visitor opens `/c/no-existe`
- **THEN** the app shows a “community not found” state
- **THEN** no login form is submitted to the API

#### Scenario: Inactive community
- **WHEN** the community exists but is inactive
- **THEN** the app shows the not-found state

### Requirement: Scoped login

`POST /api/auth/login` SHALL accept an optional `communitySlug` and scope membership
resolution to that community.

#### Scenario: Single membership in the community
- **WHEN** the user has exactly one active membership in the requested community
- **THEN** the response contains tokens and that membership as the active context

#### Scenario: Multiple memberships in the community
- **WHEN** the user has more than one active membership in the requested community
- **THEN** the response contains `requiresContextSelection: true` and only those
  memberships
- **THEN** the client must call `POST /api/auth/context`

#### Scenario: No membership in the community
- **WHEN** the user has no membership in the requested community
- **THEN** the response has status 403 with a generic message
- **THEN** the response does not reveal memberships in other communities

#### Scenario: Membership only in another community
- **WHEN** the user belongs to another community but not to the requested one
- **THEN** the response has status 403

#### Scenario: Unknown community slug
- **WHEN** `communitySlug` does not resolve to an active community
- **THEN** the response has status 404

#### Scenario: Platform admin
- **WHEN** a platform admin logs in with a `communitySlug`
- **THEN** the response contains the platform context
- **THEN** the platform context is not restricted to the community

### Requirement: Context switching after scoped login

The active context SHALL remain changeable without re-authentication.

#### Scenario: Switch to another owned membership
- **WHEN** a user who entered through `/c/torre-norte` calls
  `POST /api/auth/context` with another membership they own
- **THEN** a new token is issued for that context
- **THEN** the previous refresh token is revoked

#### Scenario: Switch to a non-owned membership
- **WHEN** the user requests a membership that does not belong to them
- **THEN** the response has status 404

### Requirement: Scoped login errors are non-enumerating

The API SHALL NOT reveal whether an email exists in another tenant.

#### Scenario: Wrong password in scoped login
- **WHEN** a scoped login uses a valid email and wrong password
- **THEN** the response has status 401 with the same message as an unknown email

#### Scenario: No access to the community
- **WHEN** the user is authenticated but has no membership in the community
- **THEN** the response has status 403 with a generic “no access to this community”
  message
