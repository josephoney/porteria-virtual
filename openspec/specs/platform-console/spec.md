# platform-console Specification

## Purpose
TBD - created by archiving change add-tenant-entry-and-platform-console. Update Purpose after archive.
## Requirements
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

Platform administrators SHALL manage organizations, including their name, geography and organization administrator.

#### Scenario: Create organization

- **WHEN** a platform admin creates an organization with `name` and optional `slug`
- **THEN** the organization is created with a valid unique slug
- **THEN** optional `municipality`, `department` and `country` are stored when provided

#### Scenario: List organizations

- **WHEN** a platform admin lists organizations with pagination and optional search
- **THEN** the response is paginated and includes name, slug, status, and community count

#### Scenario: Update organization

- **WHEN** a platform admin updates the name or slug
- **THEN** the change is persisted and audited as `organization.updated`

#### Scenario: Rename does not change the slug

- **WHEN** a platform admin changes only the organization name
- **THEN** the slug stays unchanged

#### Scenario: Duplicate name

- **WHEN** a platform admin renames an organization to an existing name
- **THEN** the response has status 409 and the change is not persisted

#### Scenario: Edit from the console

- **WHEN** a platform admin clicks “Editar” on an organization row
- **THEN** a dialog opens with the current name and the current administrator
- **THEN** saving sends `PATCH /api/platform/organizations/:id`

#### Scenario: Invalid slug

- **WHEN** the slug is invalid or already used
- **THEN** the response has status 400 or 409

### Requirement: Community management

Platform administrators SHALL read communities; community writes SHALL be performed by
organization administrators.

#### Scenario: List communities
- **WHEN** a platform admin lists communities with optional `organizationId`
- **THEN** the response is paginated and includes organization name and slug

#### Scenario: Read community
- **WHEN** a platform admin opens a community
- **THEN** the profile and hierarchy are visible

#### Scenario: No community write
- **WHEN** a platform admin tries to create, update or delete a community
- **THEN** the response has status 403

### Requirement: Unit management

Platform administrators SHALL manage units within a community and section.

#### Scenario: Create unit
- **WHEN** a unit is created with `communityId`, optional `sectionId`, `code`, optional
  `floor`, and `type`
- **THEN** it is persisted with a unique code per community
- **THEN** the section belongs to the same community

#### Scenario: List units
- **WHEN** units are listed with optional `communityId`, `sectionId` and `status`
- **THEN** the response is paginated with code, type, floor, section, community and
  status

#### Scenario: Duplicate unit code
- **WHEN** a unit code already exists in the community
- **THEN** the response has status 409

#### Scenario: Invalid section
- **WHEN** `sectionId` belongs to another community
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

The dashboard SHALL expose `/platform` for platform administrators as a route-based
console.

#### Scenario: Platform navigation
- **WHEN** a platform admin logs in
- **THEN** the sidebar shows Administración with Resumen, Organizaciones, Comunidades,
  Estructura, Unidades, Invitaciones and Usuarios
- **THEN** it shows Análisis with Bitácora, Reportes and Historial
- **THEN** `/platform` renders the Resumen dashboard

#### Scenario: Non-platform user
- **WHEN** a non-platform user navigates to `/platform/*`
- **THEN** the app redirects to their allowed home

#### Scenario: Console sections
- **WHEN** the console is open
- **THEN** each of the six structure sections is a separate route with a central table
- **THEN** each list supports pagination, search, filters and a create action
- **THEN** the legacy “Torres” tab is replaced by “Estructura”, with a “Secciones” tab
  for the flat list and an “Árbol” tab for the hierarchy

#### Scenario: Platform analysis
- **WHEN** a platform admin opens Bitácora, Reportes or Historial
- **THEN** the matching analysis route renders with global scope

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

### Requirement: Organization administrator transfer

A platform administrator SHALL be able to change the `org_admin` of an organization by email, and the organization MUST NOT be left without an active administrator.

#### Scenario: Existing account

- **WHEN** a platform admin sends `administratorEmail` for an email that already has a user account
- **THEN** the transfer is immediate
- **THEN** the new user has an active `org_admin` membership in that organization
- **THEN** every other active `org_admin` membership of that organization is deactivated

#### Scenario: New email

- **WHEN** a platform admin sends `administratorEmail` for an email without an account
- **THEN** an `org_admin` invitation is created for that organization
- **THEN** the current administrator stays active
- **THEN** the response includes the `acceptUrl` once

#### Scenario: Pending administrator is visible

- **WHEN** the organization has a pending `org_admin` invitation
- **THEN** the organization detail and the edit dialog show “Administrador pendiente: {email}”

#### Scenario: Invitation accepted

- **WHEN** the invited email accepts the invitation
- **THEN** the new membership is active
- **THEN** the previous `org_admin` membership of that organization is deactivated in the same transaction

#### Scenario: Unchanged administrator

- **WHEN** the sent `administratorEmail` matches the current active administrator
- **THEN** no membership changes and no transfer event is recorded

#### Scenario: Scope

- **WHEN** an `org_admin` or `community_admin` calls `PATCH /api/platform/organizations/:id`
- **THEN** the response has status 403

#### Scenario: Audit

- **WHEN** the administrator changes
- **THEN** an `organization.administrator_changed` event is recorded with the previous and new email and whether the transfer is pending

### Requirement: Staff management in platform console

The platform console SHALL let superadmins manage operational staff.

#### Scenario: Create operator
- **WHEN** a superadmin creates an operator
- **THEN** they select an organization and one or more communities
- **THEN** the operator memberships are created

#### Scenario: Create guard
- **WHEN** a superadmin creates a guard
- **THEN** they select an organization and one or more communities
- **THEN** the guard memberships are created

#### Scenario: Edit staff assignments
- **WHEN** a superadmin edits a staff member
- **THEN** they can add/remove communities
- **THEN** the change is audited

#### Scenario: List staff
- **WHEN** a superadmin lists staff
- **THEN** the response includes role, organization, communities and status

### Requirement: Global reports in platform console

The platform console SHALL expose global reports.

#### Scenario: Report by organization
- **WHEN** a superadmin selects an organization
- **THEN** the report shows its communities and aggregated metrics

#### Scenario: Report by community
- **WHEN** a superadmin selects a community
- **THEN** the report shows its users, staff, access and pass metrics

#### Scenario: Export
- **WHEN** a superadmin exports a report
- **THEN** the export is scoped to the selected filters

