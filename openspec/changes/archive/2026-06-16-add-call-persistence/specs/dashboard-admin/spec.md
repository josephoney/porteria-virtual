## ADDED Requirements

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
The call history table SHALL follow the existing design system.

#### Scenario: Same design tokens
- **WHEN** the call history table is rendered
- **THEN** it uses the same table styles as `UsersTable` (`.users-table` class pattern)
- **THEN** buttons and selects follow the existing `.btn-primary`, `.form-input` styles
- **THEN** badges use the existing `.badge-*` color classes
