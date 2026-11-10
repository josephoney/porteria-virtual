## ADDED Requirements

### Requirement: Search users by email, name or document

The users list SHALL support a text search that matches the account email, the account name, the person first or last name, and the person document number.

#### Scenario: Search by email

- **WHEN** an admin types part of a user email in the search field
- **THEN** the list shows only users whose email matches, case-insensitively

#### Scenario: Search by name or document

- **WHEN** an admin types part of a person name or document number
- **THEN** the list shows only users whose person name or document matches, case-insensitively

#### Scenario: Clear search

- **WHEN** the admin clears the search field
- **THEN** the list returns to the unfiltered result for the current scope

### Requirement: Filter users by account status

The users list SHALL filter by global account status.

#### Scenario: Status filter options

- **WHEN** the admin opens the status filter
- **THEN** the options are “Todos”, “Activos” and “Inactivos”

#### Scenario: Filter inactive users

- **WHEN** the admin selects “Inactivos”
- **THEN** the list shows only users with `users.active = false`
- **AND** the pagination resets to page 1

### Requirement: Show scoped user totals

The users table SHALL show how many users exist in the current administrative scope and how many match the active filters.

#### Scenario: Organization admin total

- **WHEN** an `org_admin` opens the users page without filters
- **THEN** the header shows “N usuarios en la organización”

#### Scenario: Community admin total

- **WHEN** a `community_admin` opens the users page without filters
- **THEN** the header shows “N usuarios en la comunidad”

#### Scenario: Organization admin filtered by community

- **WHEN** an `org_admin` filters by a community
- **THEN** the header shows “N usuarios en <comunidad>”

#### Scenario: Active filters

- **WHEN** any search or status filter is active
- **THEN** the header also shows “M resultados de N usuarios”

### Requirement: One row per membership with merged identity columns

The users table SHALL render one row per community membership and SHALL merge the identity columns for multi-community users.

#### Scenario: Single-community user

- **WHEN** a user has one membership
- **THEN** the table shows one row with Cuenta, Persona, Documento, Comunidad, Membresía and Estado

#### Scenario: Multi-community user

- **WHEN** a user has memberships in two or more communities
- **THEN** the table shows one row per community membership
- **AND** the Cuenta, Persona, Documento and Estado cells use `rowSpan` to merge across those rows
- **AND** each membership row shows its own community and role

### Requirement: Compact membership actions

The Membresía column SHALL use two horizontal icon buttons instead of text buttons.

#### Scenario: Add assignment

- **WHEN** the admin activates the add-assignment icon
- **THEN** the existing assignment dialog opens
- **AND** the icon has an accessible label and tooltip

#### Scenario: Remove assignment

- **WHEN** the admin activates the remove-assignment icon on an active membership
- **THEN** the membership status is set to inactive
- **AND** the row remains visible with the inactive state

### Requirement: Global account status toggle

The Estado column SHALL show a single green/red toggle per user that changes the global account status.

#### Scenario: Deactivate a user

- **WHEN** the admin clicks the green active toggle
- **THEN** the UI optimistically shows the red inactive state
- **AND** `PATCH /api/users/:id` is called with `{ active: false }`
- **AND** a failed request rolls the toggle back

#### Scenario: Reactivate a user

- **WHEN** the admin clicks the red inactive toggle
- **THEN** the UI optimistically shows the green active state
- **AND** `PATCH /api/users/:id` is called with `{ active: true }`

### Requirement: Compact rows

The users table SHALL keep each membership row compact.

#### Scenario: Row height and controls

- **WHEN** the table renders
- **THEN** each row uses a single line of content where possible
- **AND** the role selector uses the small size
- **AND** the action icons use the extra-small icon size
- **AND** rows do not grow because of stacked membership buttons

### Requirement: Users API supports filters and scoped totals

`GET /api/users` SHALL accept the filter and pagination parameters required by the table.

#### Scenario: Supported query parameters

- **WHEN** the client requests `GET /api/users`
- **THEN** it may send `search`, `status`, `communityId`, `page` and `pageSize`
- **AND** the response includes `data`, `total`, `scopeTotal`, `page` and `pageSize`
- **AND** `scopeTotal` is the unfiltered count for the requester scope
