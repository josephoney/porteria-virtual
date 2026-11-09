## ADDED Requirements

### Requirement: Community profile fields

The system SHALL store a community profile with contact, type, coordinates and branding.

#### Scenario: Profile fields
- **WHEN** a community profile is read
- **THEN** it includes name, slug, organization, address, phone, type, type label,
  latitude, longitude, logo and welcome message

#### Scenario: Address and coordinates
- **WHEN** a community is created or updated
- **THEN** the address is a human-readable street address
- **THEN** latitude and longitude are optional independent coordinates

#### Scenario: Coordinate validation
- **WHEN** latitude is outside `-90..90` or longitude is outside `-180..180`
- **THEN** the update is rejected with status 400

### Requirement: Community type

Communities SHALL have a controlled type with a custom fallback.

#### Scenario: Catalog values
- **WHEN** a community type is saved
- **THEN** it is one of `conjunto`, `condominio`, `club`, `hotel`, `edificio` or `otro`

#### Scenario: Other requires label
- **WHEN** a community type is `otro` and `type_label` is empty
- **THEN** the update is rejected with status 400

#### Scenario: Custom label
- **WHEN** a community type is `otro` with a custom label
- **THEN** the label is displayed instead of the enum value

### Requirement: Community creation and editing

Community profile writes SHALL follow the administrative hierarchy.

#### Scenario: Org admin creates community
- **WHEN** an `org_admin` creates a community in their organization
- **THEN** the community is created with the organization
- **THEN** the org admin can edit it without a `community_admin` membership

#### Scenario: Org admin edits any community in scope
- **WHEN** an `org_admin` edits a community of their organization
- **THEN** the update is allowed and audited

#### Scenario: Community admin edits assigned community
- **WHEN** a `community_admin` edits a community where they have an active membership
- **THEN** the update is allowed and audited

#### Scenario: Community admin creates community
- **WHEN** a `community_admin` tries to create a community
- **THEN** the response has status 403

#### Scenario: Cross-organization access
- **WHEN** an admin edits a community from another organization
- **THEN** the response has status 404

#### Scenario: Superadmin read-only
- **WHEN** a platform admin requests community profiles
- **THEN** the profiles are returned
- **WHEN** the platform admin tries to mutate a community
- **THEN** the response has status 403

### Requirement: Community administrator invitation

Community administrator assignment SHALL use the invitation flow.

#### Scenario: Invite community admin
- **WHEN** an org admin invites an email as `community_admin` for a selected community
- **THEN** an invitation is created with the organization and community
- **THEN** acceptance creates a `community_admin` membership for that community

#### Scenario: Multiple communities
- **WHEN** the same person is invited as `community_admin` for two communities
- **THEN** two active memberships are created
- **THEN** the person can switch between both community contexts

#### Scenario: Duplicate membership
- **WHEN** an invitation would create a duplicate active community membership
- **THEN** the response has status 409

#### Scenario: Scope violation
- **WHEN** an org admin invites a community admin outside their organization
- **THEN** the response has status 404

### Requirement: Community branding and welcome

Communities SHALL support a logo and welcome message.

#### Scenario: Community logo
- **WHEN** a community has a logo asset
- **THEN** the community view shows that logo

#### Scenario: Fallback logo
- **WHEN** a community has no logo
- **THEN** the default platform icon is shown

#### Scenario: Community welcome
- **WHEN** a community has a welcome message
- **THEN** its overview shows it to users in scope

#### Scenario: Empty welcome
- **WHEN** the welcome message is null
- **THEN** the overview shows the default empty state
