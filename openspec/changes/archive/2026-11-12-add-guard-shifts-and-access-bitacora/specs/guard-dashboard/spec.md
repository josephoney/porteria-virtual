## ADDED Requirements

### Requirement: Guard dashboard

The dashboard SHALL provide a real guard panel at `/guard`.

#### Scenario: Personal information

- **WHEN** a guard opens `/guard`
- **THEN** the panel shows name, email, community and assigned default access point

#### Scenario: Current shift

- **WHEN** the guard has an open shift
- **THEN** the panel shows the start time, current access point and elapsed time
- **THEN** it offers "Cambiar acceso" and "Cerrar turno"

#### Scenario: No shift

- **WHEN** the guard has no open shift
- **THEN** the panel offers "Iniciar turno" with the default access point preselected

#### Scenario: Start, change and end

- **WHEN** the guard starts, changes or ends a shift
- **THEN** the panel refreshes the current shift and its bitácora

#### Scenario: Bitácora feed

- **WHEN** the guard is on shift
- **THEN** the panel shows the bitácora of the current access point
- **THEN** the guard can filter by date and entry type

#### Scenario: Manual entry

- **WHEN** the guard adds a manual entry
- **THEN** it appears at the top of the current access point feed

#### Scenario: Comments

- **WHEN** the guard opens an entry
- **THEN** the guard can read and add comments
- **THEN** the guard cannot edit or delete the entry

#### Scenario: Guard scope

- **WHEN** the guard browses history
- **THEN** only access points where the guard has worked are visible

### Requirement: Admin access point management

The dashboard SHALL let community and organization admins manage named access points.

#### Scenario: Access points page

- **WHEN** an admin opens the access points page
- **THEN** the page lists the community access points with name, type, direction and
  active state
- **THEN** the admin can create, rename, change direction and deactivate

#### Scenario: Guard selector

- **WHEN** an admin edits a guard membership
- **THEN** the admin can assign a default access point

### Requirement: Access bitácora page

The dashboard SHALL provide a Bitácora de accesos page for admins.

#### Scenario: Community view

- **WHEN** a community admin opens the page
- **THEN** the page lists entries for the whole community
- **THEN** the admin can filter by access point, date range and type

#### Scenario: Access point view

- **WHEN** the admin filters by an access point
- **THEN** only entries for that physical place are shown

#### Scenario: Entry detail

- **WHEN** the admin opens an entry
- **THEN** the detail shows the full visitor snapshot, vehicle plate, location path,
  authorizer, shift and author
- **THEN** the admin can add a comment

#### Scenario: Active guards

- **WHEN** the admin views an access point
- **THEN** the page shows the guards with an open segment there

### Requirement: Auditoría page

The dashboard SHALL keep technical events in a separate Auditoría page.

#### Scenario: Rename

- **WHEN** the user opens the previous Bitácora page
- **THEN** it is labeled "Auditoría"
- **THEN** it continues to read technical events

#### Scenario: No mixing

- **WHEN** the user opens Bitácora de accesos
- **THEN** only `bitacora_entries` are shown
- **THEN** technical events are not mixed into that feed
