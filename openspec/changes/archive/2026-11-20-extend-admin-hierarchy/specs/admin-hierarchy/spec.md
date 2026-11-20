## ADDED Requirements

### Requirement: Administrative hierarchy

The platform SHALL enforce the hierarchy
**Superadmin -> Organización -> Comunidad -> Ubicaciones -> Usuarios**.

#### Scenario: Hierarchy ownership
- **WHEN** an organization is created
- **THEN** it owns its communities
- **WHEN** a community is created
- **THEN** it owns its locations, staff, residents and passes

#### Scenario: Cross-tenant access
- **WHEN** a user tries to read or mutate a resource outside their scope
- **THEN** the response is 403 or 404 (not found, without leaking existence)

### Requirement: Superadmin powers

The superadmin SHALL manage organizations, staff and global reports, and SHALL read
tenant hierarchy data without editing it.

#### Scenario: Manage organizations
- **WHEN** a superadmin creates an organization
- **THEN** the organization is created with name, slug and the first org-admin invitation

#### Scenario: Read tenant hierarchy
- **WHEN** a superadmin lists organizations, communities, profiles, sections or units
- **THEN** the records are visible
- **WHEN** the superadmin tries to create or update a community, profile, section or unit
- **THEN** the response has status 403

#### Scenario: Manage staff
- **WHEN** a superadmin creates an operator or guard
- **THEN** they assign an organization and one or more communities
- **THEN** the staff member receives one membership per community

#### Scenario: Consult users
- **WHEN** a superadmin searches users
- **THEN** results include organization and community columns and can be filtered

#### Scenario: Global reports
- **WHEN** a superadmin requests reports
- **THEN** they can filter by organization and community

### Requirement: Org admin powers

The org admin SHALL manage their organization and every community in it.

#### Scenario: Create community
- **WHEN** an org_admin creates a community in their organization
- **THEN** the community is created
- **THEN** the org_admin can manage it without a community-admin membership

#### Scenario: Manage every community in scope
- **WHEN** an org_admin accesses any community in their organization
- **THEN** the request is authorized
- **THEN** no additional community membership is required

#### Scenario: Manage community admins and users
- **WHEN** an org_admin creates or edits users of their organization
- **THEN** the assignment is limited to roles within their organization
- **THEN** `org_admin` cannot be delegated by an org_admin

#### Scenario: Organization reports
- **WHEN** an org_admin requests reports
- **THEN** only their organization's data is returned

### Requirement: Community admin powers

The community admin SHALL manage assigned communities and MAY hold memberships in
multiple communities, but SHALL NOT create communities or organizations.

#### Scenario: Manage structure
- **WHEN** a community_admin creates or edits locations of an assigned community
- **THEN** the change is allowed and audited

#### Scenario: Manage residents and users
- **WHEN** a community_admin creates or edits residents or community users
- **THEN** the users are scoped to their communities
- **THEN** they cannot assign `org_admin` or another community

#### Scenario: Multiple assigned communities
- **WHEN** a person has community_admin memberships in two communities
- **THEN** the context switcher lists both
- **THEN** each membership grants access only to its community

#### Scenario: No community creation
- **WHEN** a community_admin tries to create a community
- **THEN** the response has status 403

#### Scenario: Community reports
- **WHEN** a community_admin requests reports
- **THEN** only their assigned communities' data is returned

### Requirement: Staff multi-community assignment

Operational staff and community admins SHALL be assignable to multiple communities.

#### Scenario: Assign multiple communities
- **WHEN** a superadmin or org_admin assigns two communities to a guard or community admin
- **THEN** two memberships are created with the same person/account
- **THEN** the user can switch context between them

#### Scenario: Remove a community
- **WHEN** a community assignment is removed
- **THEN** the staff member loses access to that community
- **THEN** the other assignments remain

### Requirement: Admin audit

Administrative changes SHALL be audited.

#### Scenario: Structure change
- **WHEN** an organization, community, location, staff member or role changes
- **THEN** an `admin.*` event is recorded with actor, entity and scope

#### Scenario: No sensitive payload
- **WHEN** an audit event is recorded
- **THEN** it does not contain passwords or tokens
