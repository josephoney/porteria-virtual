## MODIFIED Requirements

### Requirement: Guard dashboard

The dashboard SHALL provide a real guard panel at `/guard`.

#### Scenario: Personal information

- **WHEN** a guard opens `/guard`
- **THEN** the panel shows name, email, community and the assigned workstation

#### Scenario: Assigned workstation state

- **WHEN** the panel renders the guard's workstation
- **THEN** an assigned and active access point is shown as the current workstation
- **THEN** an assigned but inactive access point is shown with an inactive warning
- **THEN** a guard without a workstation sees "Sin puesto asignado" and is told to ask an
  administrator

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

The dashboard SHALL let community and organization admins manage named access points and
the guards assigned to them.

#### Scenario: Access points page

- **WHEN** an admin opens the access points page
- **THEN** the page lists the community access points with name, type, direction, active
  state and the number of guards assigned to each one
- **THEN** the admin can create, rename, change direction and deactivate

#### Scenario: Guard selector

- **WHEN** an admin chooses the workstation action on a guard membership from the users
  table
- **THEN** a dialog offers the active access points of that membership community
- **THEN** the dialog offers "Sin asignar" to clear the workstation
- **THEN** the change is saved through the workstation endpoint
- **THEN** the users table reflects the new workstation without a page reload

#### Scenario: Guard selector visibility

- **WHEN** the membership role is not `guard`, or the actor cannot assign that role
- **THEN** the workstation action is not offered

#### Scenario: Open shift warning

- **WHEN** the guard has an open shift while the admin changes the workstation
- **THEN** the dialog warns that the change applies to the next shift
- **THEN** the open shift keeps its current access point

#### Scenario: Assigned guards per access point

- **WHEN** the admin opens the detail of an access point
- **THEN** the page lists the guards assigned to it with their shift state
- **THEN** the list distinguishes assigned guards from guards currently on shift
