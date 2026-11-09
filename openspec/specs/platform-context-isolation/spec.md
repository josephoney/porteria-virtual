# platform-context-isolation Specification

## Purpose
TBD - created by archiving change fix-critical-security-and-tenant. Update Purpose after archive.
## Requirements
### Requirement: Tenant endpoints in platform context

A platform-admin token without a tenant membership SHALL NOT query tenant endpoints.

#### Scenario: Platform admin calls tenant endpoint
- **WHEN** a platform admin calls `/api/communities`, `/api/kiosks`, `/api/calls`,
  `/api/events`, or `/api/reports/*`
- **THEN** the response is 403 with a message indicating that a tenant context is
  required
- **THEN** the response is not 500

#### Scenario: Platform admin with tenant context
- **WHEN** the platform admin switches to a tenant membership
- **THEN** tenant endpoints behave as that role/community

#### Scenario: Tenant user calls platform endpoint
- **WHEN** an org_admin or community_admin calls `/api/platform/*`
- **THEN** the response is 403

### Requirement: Dashboard platform navigation

The dashboard SHALL show only platform-appropriate navigation in platform context.

#### Scenario: Platform home
- **WHEN** a platform admin logs in
- **THEN** the app shows `/platform` as the home
- **THEN** Operator, Admin, and Guard items are hidden or disabled if no tenant context
  exists

#### Scenario: Tenant context switch
- **WHEN** the platform admin has a tenant membership and selects it
- **THEN** the tenant navigation becomes available

#### Scenario: No 500 UI
- **WHEN** a platform admin opens a tenant route without context
- **THEN** the app shows a clear “seleccioná una comunidad” state

### Requirement: Global user consultation

Platform admins SHALL consult users globally only from a platform screen.

#### Scenario: Global users
- **WHEN** a platform admin opens the platform console
- **THEN** they can search users across organizations with organization/community
  columns

#### Scenario: Tenant Users tab
- **WHEN** a platform admin has no tenant context
- **THEN** the tenant Users tab is not rendered

