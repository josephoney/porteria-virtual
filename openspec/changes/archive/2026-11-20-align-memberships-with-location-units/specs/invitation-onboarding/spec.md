## MODIFIED Requirements

### Requirement: Invitations table

The system SHALL store onboarding invitations with a single-use token hash.

#### Scenario: Invitation columns
- **WHEN** the schema is inspected
- **THEN** `invitations` includes `id`, `token_hash`, `email`, `organization_id`,
  `community_id?`, `location_unit_id?`, `role`, `status`, `expires_at`, `accepted_at`,
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
- **THEN** the invitation is created without community or location unit

#### Scenario: Org admin invites community staff
- **WHEN** an `org_admin` invites an email as `community_admin` in their organization
- **THEN** the invitation is created with the selected community

#### Scenario: Community admin invites resident
- **WHEN** an `org_admin` or `community_admin` invites an email as `resident` for a leaf
  in their community
- **THEN** the invitation is created with community and `location_unit_id`

#### Scenario: Scope violation
- **WHEN** a `community_admin` tries to invite a role or location outside their community
- **THEN** the response has status 403

#### Scenario: Role scope validation
- **WHEN** an occupant role is invited without a location unit
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
