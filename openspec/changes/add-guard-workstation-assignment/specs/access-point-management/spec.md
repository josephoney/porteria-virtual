## MODIFIED Requirements

### Requirement: Access point CRUD

The system SHALL expose CRUD for access points scoped to the community.

#### Scenario: List active access points

- **WHEN** a guard lists access points for their community
- **THEN** only active access points are returned
- **THEN** each item includes `id`, `name`, `type` and `direction`

#### Scenario: List all for admins

- **WHEN** a community or organization admin lists access points
- **THEN** inactive access points are included
- **THEN** each item includes `assignedGuards`, the number of active guard memberships
  whose workstation is that access point

#### Scenario: Update

- **WHEN** an admin updates the name, type or direction
- **THEN** the change is persisted
- **THEN** the previous bitácora entries keep their `access_point_name` snapshot

#### Scenario: Deactivate

- **WHEN** an admin deactivates an access point
- **THEN** `active = false`
- **THEN** new shifts cannot start there
- **THEN** existing history is preserved

#### Scenario: Deactivation keeps workstation assignments

- **WHEN** an admin deactivates an access point that is some guard's workstation
- **THEN** the assignment is preserved
- **THEN** `assignedGuards` still counts those guard memberships
- **THEN** the guard is told the workstation is inactive when reading it

#### Scenario: Cross-community access

- **WHEN** a community admin targets an access point of another community
- **THEN** the response has status 403
