## ADDED Requirements

### Requirement: Platform administrator guard

The API SHALL protect `/api/platform/*` for platform administrators only.

#### Scenario: Platform admin access
- **WHEN** a user with `is_platform_admin = true` calls a platform endpoint
- **THEN** the request proceeds without requiring a tenant membership

#### Scenario: Tenant admin access
- **WHEN** an `org_admin` or `community_admin` calls a platform endpoint
- **THEN** the response has status 403

#### Scenario: No token
- **WHEN** a platform endpoint is called without a valid token
- **THEN** the response has status 401

### Requirement: Organization management

Platform administrators SHALL manage organizations.

#### Scenario: Create organization
- **WHEN** a platform admin creates an organization with `name` and optional `slug`
- **THEN** the organization is created with a valid unique slug

#### Scenario: List organizations
- **WHEN** a platform admin lists organizations with pagination and optional search
- **THEN** the response is paginated and includes name, slug, status, and community count

#### Scenario: Update organization
- **WHEN** a platform admin updates the name or slug
- **THEN** the change is persisted and audited

#### Scenario: Invalid slug
- **WHEN** the slug is invalid or already used
- **THEN** the response has status 400 or 409

### Requirement: Community management

Platform administrators SHALL manage communities.

#### Scenario: Create community
- **WHEN** a platform admin creates a community with `organizationId`, `name`,
  `address`, `timezone`, and optional `slug`
- **THEN** the community is created and its slug is unique

#### Scenario: List communities
- **WHEN** a platform admin lists communities with optional `organizationId`
- **THEN** the response is paginated and includes organization name and slug

#### Scenario: Update community
- **WHEN** a platform admin updates name, address, timezone, status, or slug
- **THEN** the change is persisted and audited

#### Scenario: Deactivate community
- **WHEN** a community is set to `inactive`
- **THEN** its public slug resolution returns 404
- **THEN** existing data is preserved

### Requirement: Building management

Platform administrators SHALL manage buildings within a community.

#### Scenario: Create building
- **WHEN** a building is created with `communityId`, `name`, optional `code`, and
  optional `floors`
- **THEN** it is persisted and linked to the community

#### Scenario: List buildings
- **WHEN** buildings are listed by community
- **THEN** the response includes id, name, code, floors, and unit count

#### Scenario: Cross-community update
- **WHEN** a building is updated with a community that does not own it
- **THEN** the response has status 404

### Requirement: Unit management

Platform administrators SHALL manage units within a community.

#### Scenario: Create unit
- **WHEN** a unit is created with `communityId`, optional `buildingId`, `code`,
  optional `floor`, and `type`
- **THEN** it is persisted with a unique code per community

#### Scenario: List units
- **WHEN** units are listed with optional `communityId` and `buildingId`
- **THEN** the response is paginated with code, type, floor, building, and status

#### Scenario: Duplicate unit code
- **WHEN** a unit code already exists in the community
- **THEN** the response has status 409

#### Scenario: Invalid building
- **WHEN** `buildingId` belongs to another community
- **THEN** the response has status 400

### Requirement: First organization administrator

Platform administrators SHALL invite the first `org_admin` of an organization.

#### Scenario: Invite org admin
- **WHEN** a platform admin invites an email as `org_admin` for an organization
- **THEN** an invitation is created with that organization and no community
- **THEN** the invitation link is returned once

#### Scenario: Organization without admin
- **WHEN** an organization has no active `org_admin`
- **THEN** the platform console shows a warning and offers the invite action

### Requirement: Platform console UI

The dashboard SHALL expose a `/platform` section for platform administrators.

#### Scenario: Platform navigation
- **WHEN** a platform admin logs in
- **THEN** the sidebar shows a “Plataforma” item
- **THEN** navigating to `/platform` renders the console

#### Scenario: Non-platform user
- **WHEN** a non-platform user navigates to `/platform`
- **THEN** the app redirects to the dashboard home

#### Scenario: Console sections
- **WHEN** the console is open
- **THEN** it provides sections for organizations, communities, buildings, units, and
  invitations
- **THEN** each list supports pagination and a create action

### Requirement: Platform audit

All platform structure changes SHALL be audited.

#### Scenario: Structure created
- **WHEN** an organization, community, building, or unit is created
- **THEN** an event is recorded with the actor, entity type, and entity id

#### Scenario: Structure updated
- **WHEN** a structure entity is updated
- **THEN** an event is recorded with the changed fields

#### Scenario: No tenant leakage
- **WHEN** a platform admin lists data
- **THEN** the response can span organizations
- **THEN** tenant-facing endpoints remain isolated by organization
