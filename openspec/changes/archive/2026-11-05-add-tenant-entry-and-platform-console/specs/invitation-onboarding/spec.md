## ADDED Requirements

### Requirement: Invitations table

The system SHALL store onboarding invitations with a single-use token hash.

#### Scenario: Invitation columns
- **WHEN** the schema is inspected
- **THEN** `invitations` includes `id`, `token_hash`, `email`, `organization_id`,
  `community_id?`, `unit_id?`, `role`, `status`, `expires_at`, `accepted_at`,
  `invited_by`, `created_at`, `updated_at`

#### Scenario: Token never stored in plain text
- **WHEN** an invitation is created
- **THEN** only the SHA-256 hash of the token is stored
- **THEN** the raw token is returned once in the invitation link

#### Scenario: Unique token
- **WHEN** a duplicate `token_hash` is inserted
- **THEN** the database rejects it

### Requirement: Create invitation

Authorized users SHALL create invitations within their membership scope.

#### Scenario: Platform admin invites org admin
- **WHEN** a platform admin invites an email as `org_admin` for an organization
- **THEN** the invitation is created without community or unit

#### Scenario: Org admin invites community staff
- **WHEN** an `org_admin` invites an email as `community_admin` in their organization
- **THEN** the invitation is created with the selected community

#### Scenario: Community admin invites resident
- **WHEN** a `community_admin` invites an email as `resident` for a unit in their
  community
- **THEN** the invitation is created with community and unit

#### Scenario: Scope violation
- **WHEN** a `community_admin` tries to invite a role or unit outside their community
- **THEN** the response has status 403

#### Scenario: Role scope validation
- **WHEN** an occupant role is invited without a unit
- **THEN** the response has status 400

#### Scenario: Existing member
- **WHEN** the email already has an active membership for the same scope and role
- **THEN** the response has status 409

#### Scenario: Link returned
- **WHEN** the invitation is created
- **THEN** the response includes the invitation link exactly once
- **THEN** the link is not retrievable again from the database

#### Scenario: Expiration
- **WHEN** an invitation is created without an explicit expiration
- **THEN** it expires after the configured default (7 days)

### Requirement: Invitation lifecycle

Invitations SHALL support revoke, resend, and expiration.

#### Scenario: Revoke
- **WHEN** an authorized user revokes a pending invitation
- **THEN** its status becomes `revoked`
- **THEN** the token can no longer be accepted

#### Scenario: Resend
- **WHEN** an authorized user resends a pending invitation
- **THEN** a new token is generated and the previous token is invalidated
- **THEN** the new link is returned once

#### Scenario: Expired invitation
- **WHEN** `expires_at` is in the past
- **THEN** the invitation is considered expired
- **THEN** acceptance returns status 410

#### Scenario: Already accepted
- **WHEN** an accepted invitation token is used again
- **THEN** the response has status 410

### Requirement: Public invitation preview

The API SHALL expose a public preview for a valid token.

#### Scenario: Valid token preview
- **WHEN** `GET /api/public/invitations/:token` is requested with a valid token
- **THEN** the response contains the community name, unit code, role, and a masked email

#### Scenario: Invalid or expired token
- **WHEN** the token is invalid, revoked, or expired
- **THEN** the response has status 404 or 410 with a generic message

#### Scenario: No sensitive data
- **WHEN** the preview is returned
- **THEN** it does not contain the full email, membership list, or user data

### Requirement: Accept invitation for a new user

A new user SHALL accept an invitation and create their account.

#### Scenario: New account
- **WHEN** `POST /api/public/invitations/:token/accept` receives `{ name, password }`
  for an email that does not exist
- **THEN** a user is created with a bcrypt password hash
- **THEN** a membership is created with the invitation scope and role
- **THEN** the invitation is marked `accepted`
- **THEN** the response contains tokens and the active membership

#### Scenario: Weak password
- **WHEN** the password has fewer than 8 characters
- **THEN** the response has status 400

#### Scenario: Duplicate email created concurrently
- **WHEN** two accepts for the same new email race
- **THEN** only one user is created
- **THEN** the other request returns status 409

### Requirement: Accept invitation for an existing user

An existing account SHALL NOT be taken over by an invitation token.

#### Scenario: Existing email without session
- **WHEN** the email already exists and the request has no valid access token
- **THEN** the response has status 409 instructing the user to log in first
- **THEN** no password is changed

#### Scenario: Existing email with session
- **WHEN** the authenticated user's email matches the invitation email
- **THEN** the membership is created for that user
- **THEN** the invitation is marked `accepted`
- **THEN** the response contains the new active context

#### Scenario: Session for a different email
- **WHEN** the authenticated user's email does not match the invitation
- **THEN** the response has status 403

### Requirement: Invitation audit and rate limiting

Invitation operations SHALL be audited and protected.

#### Scenario: Audit events
- **WHEN** an invitation is created, revoked, resent, accepted, or expires
- **THEN** an event is recorded with the invitation id, actor, and result

#### Scenario: Rate limit create
- **WHEN** an actor exceeds the configured invitations per hour
- **THEN** the response has status 429

#### Scenario: Rate limit accept
- **WHEN** a token or IP exceeds the configured accept attempts per minute
- **THEN** the response has status 429

### Requirement: Delivery adapter

Invitation delivery SHALL be behind an adapter so email can be added later.

#### Scenario: Manual provider
- **WHEN** no email provider is configured
- **THEN** the system returns the invitation link to the admin
- **THEN** the operation succeeds without sending email

#### Scenario: Email provider later
- **WHEN** an email provider is configured
- **THEN** the link is delivered through it without changing the invitation domain logic
### Requirement: Invitation acceptance page

The dashboard SHALL expose a public `/invite/:token` route.

#### Scenario: Valid token renders the acceptance page
- **WHEN** a visitor opens `/invite/:token` with a valid token
- **THEN** the app shows the community, unit, role and masked email
- **THEN** it shows a form for new users or a login prompt for existing accounts

#### Scenario: New user completes the form
- **WHEN** the visitor submits name and password
- **THEN** the app calls `POST /api/public/invitations/:token/accept`
- **THEN** on success it stores the returned tokens and redirects to the dashboard with the active context

#### Scenario: Existing user
- **WHEN** the preview email already has an account
- **THEN** the page prompts the user to log in first
- **THEN** after login it submits the accept request with the session

#### Scenario: Invalid, expired or revoked token
- **WHEN** the token is invalid, expired or revoked
- **THEN** the page shows a generic invalid-invitation state
- **THEN** no form is submitted