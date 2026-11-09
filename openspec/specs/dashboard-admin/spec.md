# Dashboard Admin Panel

## Purpose

Provides the admin panel within the dashboard: user management with paginated listing, create/edit user forms, role management, and active status toggling. All operations go through the REST API with JWT authentication.
## Requirements
### Requirement: Users list
The admin SHALL see a paginated table of all users in their organization.

#### Scenario: Users table rendered
- **WHEN** the admin navigates to `/admin`
- **THEN** a table displays users with columns: Email, Name, Role, Active, Actions
- **THEN** pagination controls are shown if total > page size

#### Scenario: Role badges
- **WHEN** users are displayed
- **THEN** each role has a distinct badge color: admin=dark, operator=blue, guard=amber, resident=green

### Requirement: Create user
The admin SHALL be able to create new users via a form.

#### Scenario: Create user form
- **WHEN** the admin clicks "Nuevo Usuario"
- **THEN** a form appears with fields: Email, Name, Password, Role
- **THEN** on submit, POST /api/users is called with the JWT token

#### Scenario: Create user success
- **WHEN** the API returns 201
- **THEN** the user appears in the table
- **THEN** the form resets

#### Scenario: Create user error
- **WHEN** the API returns 409 (duplicate email)
- **THEN** an error message "El email ya está en uso" is shown

### Requirement: Edit user
The admin SHALL be able to edit user role and active status.

#### Scenario: Toggle active status
- **WHEN** the admin toggles the active switch
- **THEN** PATCH /api/users/:id is called with `{ active: true/false }`
- **THEN** the row updates without page reload

#### Scenario: Change role
- **WHEN** the admin selects a new role from the dropdown
- **THEN** PATCH /api/users/:id is called with `{ role }`
- **THEN** the badge updates immediately

### Requirement: Call history table
The admin panel SHALL include a paginated call history table with status and date filters.

#### Scenario: Table renders with call data
- **WHEN** the admin navigates to `/admin`
- **THEN** below the users section, a "Historial de Llamadas" section is displayed
- **THEN** a table shows calls with columns: Status, Kiosk, Operator, Access Point, Started, Duration
- **THEN** calls are fetched via `GET /api/calls` using the existing `apiClient`

#### Scenario: Status badges
- **WHEN** calls are displayed
- **THEN** pending calls show a gray badge ("Pendiente")
- **THEN** active calls show a green badge ("Activa")
- **THEN** ended calls show a blue badge ("Finalizada")
- **THEN** missed calls show an amber badge ("Perdida")

#### Scenario: Status filter
- **WHEN** the admin selects a status from the filter dropdown
- **THEN** `GET /api/calls?status=<selected>` is called
- **THEN** only calls with that status are displayed

#### Scenario: Date range filter
- **WHEN** the admin sets "Desde" and "Hasta" date inputs
- **THEN** `GET /api/calls?from=<date>&to=<date>` is called
- **THEN** only calls within that range are displayed

#### Scenario: Pagination
- **WHEN** there are more than 10 calls
- **THEN** pagination controls (← page / total →) are shown
- **THEN** clicking next/prev fetches the corresponding page

#### Scenario: Empty state
- **WHEN** there are no calls matching the filters
- **THEN** a message "No hay llamadas registradas" is displayed

#### Scenario: Operator filter (admin only)
- **WHEN** the admin is viewing the table
- **THEN** an optional operator filter dropdown is available to filter by specific operator
- **THEN** selecting an operator adds `?operatorId=<id>` to the API call

### Requirement: Call history design consistency

The call history table SHALL use the shared design system.

#### Scenario: Shared components
- **WHEN** the call history table is rendered
- **THEN** it uses the shared `Table`, `Button`, `Badge` and `Select` components
- **THEN** it uses semantic tokens for color, spacing and borders
- **THEN** it does not use legacy class names or hardcoded colors

### Requirement: Admin panel design consistency

The admin panel SHALL follow the shared design system in light and dark mode.

#### Scenario: Same design system
- **WHEN** the admin panel is rendered
- **THEN** it uses the same semantic color, typography and radius tokens as the rest of
  the dashboard
- **THEN** it uses `font-sans` for UI and `font-mono` for technical data
- **THEN** it has no hardcoded colors, font families or legacy visual aliases
- **THEN** it remains legible in both light and dark mode

