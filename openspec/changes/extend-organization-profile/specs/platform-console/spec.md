## MODIFIED Requirements

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

## ADDED Requirements

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
