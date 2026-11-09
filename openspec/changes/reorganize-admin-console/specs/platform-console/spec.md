## MODIFIED Requirements

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

### Requirement: Platform console UI

The dashboard SHALL expose `/platform` for platform administrators as a route-based
console.

#### Scenario: Platform navigation
- **WHEN** a platform admin logs in
- **THEN** the sidebar shows Administración with Resumen, Organizaciones, Comunidades,
  Secciones, Unidades, Invitaciones and Usuarios
- **THEN** it shows Análisis with Bitácora, Reportes and Historial
- **THEN** `/platform` renders the Resumen dashboard

#### Scenario: Non-platform user
- **WHEN** a non-platform user navigates to `/platform/*`
- **THEN** the app redirects to their allowed home

#### Scenario: Console sections
- **WHEN** the console is open
- **THEN** each of the six structure sections is a separate route with a central table
- **THEN** each list supports pagination, search, filters and a create action
- **THEN** the legacy “Torres” tab is replaced by “Secciones”

#### Scenario: Platform analysis
- **WHEN** a platform admin opens Bitácora, Reportes or Historial
- **THEN** the matching analysis route renders with global scope

## REMOVED Requirements

### Requirement: Building management

**Reason**: The platform console now manages sections through the generic location
hierarchy; `buildings` is migrated to level 1 sections.

**Migration**: Existing buildings become sections with `sectionType = 'building'`; the
section model, API and migration live in `add-configurable-location-hierarchy`.
