## ADDED Requirements

### Requirement: Organization overview read model

The platform console SHALL expose an organization overview for superadmins.

#### Scenario: Organization overview
- **WHEN** a superadmin requests `GET /api/platform/organizations/:id/overview`
- **THEN** the response includes organization name, slug, NIT, phone, address and profile
  status
- **THEN** it includes the legal representative, when present
- **THEN** it includes the active or pending organization administrator
- **THEN** it includes communities with section and unit counts

#### Scenario: Read-only superadmin
- **WHEN** a superadmin requests the overview
- **THEN** the response is returned
- **WHEN** the superadmin tries to edit the organization profile, community, section or
  unit
- **THEN** the response has status 403

#### Scenario: Hierarchy ownership
- **WHEN** an organization has communities
- **THEN** each community appears only under that organization

### Requirement: Community overview read model

The hierarchy SHALL expose a community overview with its locations.

#### Scenario: Community overview
- **WHEN** an authorized admin requests `GET /api/communities/:id/overview`
- **THEN** the response includes community profile, administrator and welcome message
- **THEN** it includes root sections and their level/unit counts

#### Scenario: Cross-tenant overview
- **WHEN** an admin requests a community from another organization
- **THEN** the response has status 404

#### Scenario: Community admin scope
- **WHEN** a community admin requests an assigned community
- **THEN** the overview is returned
- **WHEN** the community admin requests another community
- **THEN** the response has status 404

### Requirement: Expandable administrative views

The dashboard SHALL present the hierarchy as expandable read views.

#### Scenario: Organization row expands
- **WHEN** a superadmin activates an organization row
- **THEN** the organization profile, legal representative, administrator and communities
  are displayed inline

#### Scenario: Community row expands
- **WHEN** an org admin activates a community row
- **THEN** community profile, administrator, sections and level counts are displayed

#### Scenario: Keyboard access
- **WHEN** the expand trigger receives keyboard focus
- **THEN** it exposes `aria-expanded` and can be activated with Enter/Space

#### Scenario: Empty hierarchy
- **WHEN** an organization has no communities or a community has no sections
- **THEN** the expanded view shows an explicit empty state

### Requirement: Mi Organización

Organization administrators SHALL have a dedicated organization settings area.

#### Scenario: Menu visibility
- **WHEN** the active role is `org_admin`
- **THEN** the sidebar shows **Mi Organización**
- **WHEN** the active role is `community_admin`, `guard`, `operator` or a resident
- **THEN** the menu is hidden

#### Scenario: Profile editing
- **WHEN** an org admin edits organization profile fields
- **THEN** the change is persisted and visible to the superadmin overview

#### Scenario: Branding
- **WHEN** an org admin uploads an organization logo or writes a welcome message
- **THEN** the sidebar and organization home reflect the change

### Requirement: Org admin community management

Organization administrators SHALL manage communities inside their organization.

#### Scenario: List own communities
- **WHEN** an org admin opens Comunidades
- **THEN** only communities from their organization are listed

#### Scenario: Create community
- **WHEN** an org admin creates a community
- **THEN** it is linked to their organization
- **THEN** the superadmin can read it

#### Scenario: Manage structure
- **WHEN** an org admin opens a community
- **THEN** they can manage its sections, levels and units

#### Scenario: No organization creation
- **WHEN** an org admin tries to create an organization
- **THEN** the request is rejected with status 403

### Requirement: Community administrator delegation

Community administrators SHALL be invited per community.

#### Scenario: Invite delegated admin
- **WHEN** an org admin invites an email as `community_admin` for a community
- **THEN** the invitation includes organization and community
- **THEN** acceptance creates that community membership

#### Scenario: Multiple communities
- **WHEN** the same person is invited to two communities
- **THEN** they receive two memberships
- **THEN** the context switcher lists both communities

#### Scenario: No community creation
- **WHEN** a community admin tries to create a community
- **THEN** the response has status 403

### Requirement: Read-only operational roles

Guard and operator roles SHALL have read-only hierarchy access.

#### Scenario: Read community
- **WHEN** a guard or operator opens their community
- **THEN** community, sections and units are visible

#### Scenario: No write actions
- **WHEN** a guard or operator attempts to create or edit hierarchy data
- **THEN** the request has status 403
- **THEN** the UI hides create/edit controls
