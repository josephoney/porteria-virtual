## MODIFIED Requirements

### Requirement: Users list

The admin SHALL see a paginated table of users in their scope at `/admin/users`.

#### Scenario: Users table rendered
- **WHEN** the admin navigates to `/admin/users`
- **THEN** a table displays users with columns: Email, Name, Role, Active, Actions
- **THEN** pagination controls are shown if total > page size
- **THEN** the table shows loading, empty and error/retry states

#### Scenario: Role badges
- **WHEN** users are displayed
- **THEN** each role has a distinct badge color
- **THEN** platform admins see organization and community columns

### Requirement: Call history table

The admin panel SHALL expose call history as a dedicated analysis page at
`/admin/calls`.

#### Scenario: Table renders with call data
- **WHEN** the admin navigates to `/admin/calls`
- **THEN** a table shows calls with columns: Status, Kiosk, Operator, Access Point,
  Started, Duration
- **THEN** calls are fetched via `GET /api/calls` using the existing `apiClient`
- **THEN** the page shows loading, empty and error/retry states

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
- **THEN** pagination controls show page/total
- **THEN** clicking next/prev fetches the corresponding page

#### Scenario: Empty state
- **WHEN** there are no calls matching the filters
- **THEN** a message "No hay llamadas registradas" is displayed

#### Scenario: Operator filter
- **WHEN** the admin is viewing the table
- **THEN** an optional operator filter is available to filter by specific operator
