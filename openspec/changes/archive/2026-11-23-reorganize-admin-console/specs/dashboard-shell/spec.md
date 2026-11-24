## MODIFIED Requirements

### Requirement: Dashboard layout

The dashboard SHALL have a shell with TopBar, Sidebar, and a main content area using
React Router, with navigation filtered by role and active scope.

#### Scenario: Layout renders with outlet
- **WHEN** the dashboard app loads and the user is authenticated
- **THEN** the TopBar is displayed with the brand, theme toggle, context selector and
  logout
- **THEN** the Sidebar shows the groups and items allowed for the active role/context
- **THEN** the main content area renders the active route

#### Scenario: Sidebar groups
- **WHEN** a guard or operator is in a tenant context
- **THEN** the sidebar shows Operación and Análisis groups
- **WHEN** an org_admin or community_admin is in a tenant context
- **THEN** the sidebar shows Operación, Administración and Análisis groups
- **WHEN** the user is in platform context
- **THEN** the sidebar shows Administración with the six platform sections and Análisis
  with Bitácora, Reportes and Historial

#### Scenario: Active route
- **WHEN** the active route changes
- **THEN** the matching sidebar item is highlighted
- **THEN** only allowed items for the role/context are shown

#### Scenario: Mobile
- **WHEN** the viewport is smaller than the mobile breakpoint
- **THEN** the sidebar collapses into a sheet
- **THEN** selecting an item closes the sheet and navigates

### Requirement: Role-based route protection

The dashboard SHALL restrict routes based on the active role and context.

#### Scenario: Admin accesses admin page
- **WHEN** an `org_admin` or `community_admin` navigates to an allowed `/admin/*` route
- **THEN** the matching page is displayed

#### Scenario: Operator cannot access admin pages
- **WHEN** an `operator` or `guard` navigates to an `/admin/*` route that is not an
  analysis route
- **THEN** they are redirected to the operator panel at `/`

#### Scenario: Analysis access
- **WHEN** an `operator`, `guard`, `community_admin` or `org_admin` navigates to
  `/analysis/bitacora` or `/analysis/reports`
- **THEN** the allowed analysis view is displayed
- **WHEN** they navigate to `/platform/history` or `/admin/history`
- **THEN** they are redirected to their first allowed page

#### Scenario: Resident is redirected
- **WHEN** a user with an `owner`, `tenant`, or `resident` membership opens `/` or an
  `/admin/*` route
- **THEN** they are redirected to `/app-required`

#### Scenario: Platform context is redirected
- **WHEN** a platform admin without a tenant context opens `/` or `/admin/*`
- **THEN** they are redirected to `/platform`

#### Scenario: Unauthorized admin item
- **WHEN** a community_admin opens `/admin/communities` or `/platform/*`
- **THEN** they are redirected to their first allowed page
