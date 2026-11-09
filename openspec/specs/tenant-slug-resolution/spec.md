# tenant-slug-resolution Specification

## Purpose
TBD - created by archiving change add-tenant-entry-and-platform-console. Update Purpose after archive.
## Requirements
### Requirement: Organization and community slugs

The system SHALL store a globally unique `slug` on `organizations` and `communities`.

#### Scenario: Unique community slug
- **WHEN** a community is created or updated with a slug already used by another
  community
- **THEN** the database rejects the change with a unique constraint violation

#### Scenario: Unique organization slug
- **WHEN** an organization is created or updated with a slug already used by another
  organization
- **THEN** the database rejects the change with a unique constraint violation

#### Scenario: Slug is required
- **WHEN** a slug is omitted on create
- **THEN** the system generates one from the name before persisting

### Requirement: Slug format and reserved words

Slugs SHALL follow a strict format and SHALL NOT use reserved words.

#### Scenario: Valid slug
- **WHEN** a slug is `torre-norte`
- **THEN** it is accepted

#### Scenario: Invalid characters
- **WHEN** a slug contains uppercase letters, spaces, accents, underscores or
  consecutive hyphens
- **THEN** the request is rejected with status 400

#### Scenario: Invalid length
- **WHEN** a slug is shorter than 3 or longer than 60 characters
- **THEN** the request is rejected with status 400

#### Scenario: Reserved word
- **WHEN** a slug is one of `api`, `admin`, `app`, `auth`, `c`, `login`, `platform`,
  `public`, `www`, `kiosk`, `resident`, `static` or `health`
- **THEN** the request is rejected with status 400

### Requirement: Slug generation and collisions

The system SHALL generate a slug from the name when one is not provided.

#### Scenario: Accents and symbols normalized
- **WHEN** the name is `Condominio Los Álamos`
- **THEN** the generated slug is `condominio-los-alamos`

#### Scenario: Collision handled
- **WHEN** the generated slug already exists
- **THEN** a numeric suffix is appended (`-2`, `-3`, …) until it is unique

#### Scenario: Generated slug respects limits
- **WHEN** the name is longer than 60 characters
- **THEN** the generated slug is truncated to 60 characters without ending in a hyphen

### Requirement: Public community resolution

The API SHALL expose `GET /api/public/communities/:slug` without authentication.

#### Scenario: Active community resolved
- **WHEN** a valid active community slug is requested
- **THEN** the response contains `id`, `name`, `slug`, `address`, `timezone`, and
  `organization: { id, name, slug }`
- **THEN** the response does not contain members, units, users, or access logs

#### Scenario: Unknown slug
- **WHEN** the slug does not exist
- **THEN** the response has status 404 with a generic message

#### Scenario: Inactive community
- **WHEN** the community status is `inactive`
- **THEN** the response has status 404

#### Scenario: Rate limited
- **WHEN** a client exceeds the configured public lookups per minute
- **THEN** the response has status 429

#### Scenario: Cacheable
- **WHEN** a valid slug is resolved
- **THEN** the response includes a short `Cache-Control` header

### Requirement: Slug updates

Platform administrators SHALL be able to change a community or organization slug with
explicit confirmation.

#### Scenario: Update slug
- **WHEN** a platform admin updates a slug to a valid unique value
- **THEN** the change is persisted and audited

#### Scenario: Update to reserved or invalid slug
- **WHEN** the new slug is reserved, invalid, or already used
- **THEN** the request is rejected with status 400 or 409

#### Scenario: Old links
- **WHEN** a slug changes
- **THEN** the system does not create aliases in this phase
- **THEN** the response includes a warning that old links will stop working

