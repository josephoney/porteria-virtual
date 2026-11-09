## ADDED Requirements

### Requirement: Tenant slugs

The system SHALL add a unique `slug` column to `organizations` and `communities`.

#### Scenario: Organization slug column
- **WHEN** the schema is inspected
- **THEN** `organizations` includes `slug` varchar(60) NOT NULL
- **THEN** a unique index exists on `organizations.slug`

#### Scenario: Community slug column
- **WHEN** the schema is inspected
- **THEN** `communities` includes `slug` varchar(60) NOT NULL
- **THEN** a unique index exists on `communities.slug`

#### Scenario: Backfill existing rows
- **WHEN** the migration runs on existing data
- **THEN** every organization and community receives a slug derived from its name
- **THEN** collisions are resolved with a numeric suffix
- **THEN** `NOT NULL` is applied after the backfill

### Requirement: Invitations table

The system SHALL have an `invitations` table for onboarding.

#### Scenario: Invitation columns
- **WHEN** the schema is inspected
- **THEN** `invitations` includes `id`, `token_hash`, `email`, `organization_id`,
  `community_id`, `unit_id`, `role`, `status`, `expires_at`, `accepted_at`,
  `invited_by`, `created_at`, `updated_at`

#### Scenario: Invitation status enum
- **WHEN** the schema is inspected
- **THEN** `status` accepts `pending`, `accepted`, `revoked`, and `expired`

#### Scenario: Invitation indexes
- **WHEN** the migration is applied
- **THEN** a unique index exists on `token_hash`
- **THEN** indexes exist on `(email, status)` and `(community_id, status)`

#### Scenario: Cascade rules
- **WHEN** an organization or community is deleted
- **THEN** its invitations are deleted
- **WHEN** the inviting user is deleted
- **THEN** `invited_by` is set to null
