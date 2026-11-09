## ADDED Requirements

### Requirement: Sidebar navigation by scope

The dashboard SHALL expose administrative navigation in the left sidebar, filtered by
role and active scope.

#### Scenario: Platform context
- **WHEN** a platform admin enters the platform context
- **THEN** the sidebar shows Resumen, Organizaciones, Comunidades, Secciones, Unidades,
  Invitaciones and Usuarios under Administración
- **THEN** it shows Bitácora, Reportes and Historial under Análisis
- **THEN** it does not show Operador or Guardia

#### Scenario: Org admin context
- **WHEN** an org_admin enters a tenant context
- **THEN** the sidebar shows Operación (Operador, Guardia), Administración (Resumen,
  Comunidades, Secciones, Unidades, Invitaciones, Usuarios) and Análisis (Bitácora,
  Reportes)
- **THEN** it does not show Historial

#### Scenario: Community admin context
- **WHEN** a community_admin enters a tenant context
- **THEN** the sidebar shows Operación, Administración (Resumen, Secciones, Unidades,
  Invitaciones, Usuarios) and Análisis (Bitácora, Reportes)
- **THEN** it does not show Organizaciones, Comunidades or Historial

#### Scenario: Guard and operator context
- **WHEN** a guard or operator enters a tenant context
- **THEN** the sidebar shows Operación and Análisis (Bitácora, Reportes)
- **THEN** it does not show Administración or Historial

### Requirement: Route-based admin sections

Administrative sections SHALL be real routes, not top-level tabs.

#### Scenario: Platform routes
- **WHEN** a platform admin navigates to `/platform`
- **THEN** the Resumen dashboard renders with platform counts
- **WHEN** a platform admin navigates to `/platform/organizations`,
  `/platform/communities`, `/platform/sections`, `/platform/units`,
  `/platform/invitations` or `/platform/users`
- **THEN** the matching list page renders in the central content area with its own title

#### Scenario: Tenant routes
- **WHEN** an org_admin or community_admin navigates to an allowed `/admin/*` route
- **THEN** the matching page renders with data scoped to their active membership

#### Scenario: Analysis routes
- **WHEN** a guard, operator, community_admin or org_admin navigates to
  `/analysis/bitacora` or `/analysis/reports`
- **THEN** the matching view renders in the central content area
- **WHEN** a superadmin navigates to `/platform/history`
- **THEN** the technical history renders

#### Scenario: Entry dashboards
- **WHEN** a platform admin opens `/platform`
- **THEN** the platform Resumen dashboard renders
- **WHEN** an org_admin or community_admin opens `/admin`
- **THEN** the tenant Resumen dashboard renders with counts scoped to their org/community

#### Scenario: Unauthorized route
- **WHEN** a user opens an administrative route they cannot access
- **THEN** the app redirects to their first allowed page
- **THEN** the API still rejects direct unauthorized requests with 403 or 404

### Requirement: Central list pages

Each administrative section SHALL render its content as a central table page.

#### Scenario: Page structure
- **WHEN** a list page is rendered
- **THEN** it shows a title, description, primary create action, filters and a table

#### Scenario: Tenant summary
- **WHEN** an org_admin or community_admin opens `/admin`
- **THEN** the page shows counts for communities, sections, units, invitations and users
  scoped to their organization or community
- **THEN** the sidebar starts with Resumen, followed by the structure pages in the same
  order as the platform console

#### Scenario: Table states
- **WHEN** data is loading, empty or fails
- **THEN** the page shows a skeleton, an empty state or an error with retry

#### Scenario: Pagination and row actions
- **WHEN** there are more rows than the page size
- **THEN** pagination shows page/total and disables the edges
- **THEN** each row exposes only the actions allowed for the caller

#### Scenario: Create and edit
- **WHEN** the user creates or edits an item
- **THEN** the form opens in a dialog or sheet
- **THEN** the table refreshes after a successful mutation

### Requirement: Sections page

The Secciones page SHALL list location sections with their semantic type.

#### Scenario: Section columns
- **WHEN** sections are listed
- **THEN** each row shows name, code, section type, community, level count, unit count
  and status

#### Scenario: Section filters
- **WHEN** the user filters by community, section type or search text
- **THEN** the table shows only matching sections scoped to the caller

#### Scenario: Section creation
- **WHEN** the user creates a section
- **THEN** they select a community, name, code and section type
- **THEN** type `other` requires a custom label
- **THEN** the section is created as a level 1 node in the location hierarchy

#### Scenario: Section editing
- **WHEN** the user changes a section's type
- **THEN** its children, units and residents remain unchanged

### Requirement: Units page

The Unidades page SHALL list location leaf units.

#### Scenario: Unit columns
- **WHEN** units are listed
- **THEN** each row shows code, section, community, unit type, floor and status

#### Scenario: Unit filters
- **WHEN** the user filters by community, section or status
- **THEN** only matching units in scope are shown

### Requirement: Invitations and users pages

Invitaciones and Usuarios SHALL be scoped list pages.

#### Scenario: Platform scope
- **WHEN** a platform admin lists invitations or users
- **THEN** results can span organizations and include organization/community columns

#### Scenario: Tenant scope
- **WHEN** an org_admin or community_admin lists invitations or users
- **THEN** results are limited to their organization or active community

#### Scenario: Invite action
- **WHEN** an allowed admin creates an invitation
- **THEN** the invitation link is returned once and the table refreshes

### Requirement: Analysis views remain accessible

Operational analysis views SHALL remain available according to role.

#### Scenario: Bitacora and reports
- **WHEN** a guard, operator, community_admin or org_admin opens Bitácora or Reportes
- **THEN** the view renders as a dedicated page under the Análisis group
- **THEN** data is scoped to their community or organization

#### Scenario: Technical history
- **WHEN** a superadmin opens Historial
- **THEN** the technical event history renders with organization/community filters
- **WHEN** a non-superadmin opens Historial
- **THEN** the item is not shown and the route is rejected

#### Scenario: Platform context
- **WHEN** a platform admin is in platform context
- **THEN** Bitácora, Reportes and Historial are shown under Análisis

### Requirement: Sidebar user menu

The sidebar footer SHALL expose the authenticated user menu.

#### Scenario: Open user menu
- **WHEN** the user clicks the avatar in the sidebar footer
- **THEN** the menu opens with Cuenta, Notificaciones, theme, context and logout actions

#### Scenario: Account
- **WHEN** the user selects Cuenta
- **THEN** a dialog shows name, email, avatar and active context

#### Scenario: Notifications
- **WHEN** the user selects Notificaciones
- **THEN** a dialog shows the current notification empty state

#### Scenario: Logout
- **WHEN** the user selects Cerrar sesión
- **THEN** the session is cleared and the app returns to `/login`

### Requirement: Active route and mobile navigation

The sidebar SHALL reflect the active route and work on mobile.

#### Scenario: Active item
- **WHEN** the user navigates to an administrative route
- **THEN** the matching sidebar item is highlighted

#### Scenario: Mobile
- **WHEN** the viewport is smaller than the mobile breakpoint
- **THEN** the sidebar opens as a sheet
- **THEN** selecting an item closes the sheet and navigates
