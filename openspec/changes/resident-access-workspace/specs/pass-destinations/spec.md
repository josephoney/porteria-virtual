## ADDED Requirements

### Requirement: Authorizable destinations

The system SHALL distinguish between the resident's home and a community common area as pass destinations.

#### Scenario: Destination values

- **WHEN** a pass is created
- **THEN** its destination is either a residential unit or an active `community_destinations` row of the same community
- **THEN** exactly one of `location_unit_id` and `destination_id` is set
- **THEN** setting both or neither is rejected with status 400 and reason `invalid_destination`

#### Scenario: Home destination

- **WHEN** the resident chooses their home
- **THEN** the pass stores `location_unit_id` with the chosen leaf unit
- **THEN** it stores the `structure_id` derived from that unit
- **AND** `destination_id` stays `NULL`

#### Scenario: Common area destination

- **WHEN** the resident chooses a common area
- **THEN** the pass stores `destination_id`
- **THEN** `location_unit_id` and `structure_id` stay `NULL`
- **AND** the pass keeps the `community_id` of the destination

#### Scenario: Archived destination

- **WHEN** a resident tries to create a pass for an archived destination
- **THEN** the API responds with status 400 and reason `destination_inactive`
- **AND** existing passes for that destination are unaffected

### Requirement: Destination catalog table

The database SHALL have a `community_destinations` table.

#### Scenario: Columns

- **WHEN** the schema is inspected
- **THEN** `community_destinations` includes `id`, `community_id`, `name`, `kind`, `description`, `status`, `created_at`, and `updated_at`
- **THEN** `community_id` references `communities(id)` with cascade delete
- **THEN** `kind` is one of `common_area`, `sport`, `recreation`, `other`
- **THEN** `status` is one of `active`, `archived`

#### Scenario: Unique name per community

- **WHEN** a destination is created with a name that already exists in the same community, ignoring case
- **THEN** the API responds with status 409 and reason `destination_name_taken`

#### Scenario: Name and kind required

- **WHEN** a destination is created without `name` or with an unknown `kind`
- **THEN** the response has status 400

#### Scenario: Pass destination reference

- **WHEN** the migration is applied
- **THEN** `access_passes.destination_id` is nullable and references `community_destinations(id)` with `ON DELETE RESTRICT`
- **THEN** `access_passes.location_unit_id` and `structure_id` become nullable
- **THEN** a check constraint enforces exactly one destination per pass
- **THEN** an index exists on `(community_id, status)`

### Requirement: Admin manages destinations

An `org_admin` or `community_admin` of the community SHALL create, edit, archive, restore, and delete destinations.

#### Scenario: Create from the community detail

- **WHEN** an admin expands a community row and uses `Agregar lugar`
- **THEN** a form asks for name, kind, and optional description
- **THEN** saving inserts the destination and shows it in the list without a page reload

#### Scenario: Edit

- **WHEN** the admin edits a destination name
- **THEN** the change is saved and reflected in the list and in future passes
- **AND** existing passes resolve the new name

#### Scenario: Archive and restore

- **WHEN** the admin archives a destination
- **THEN** the destination stops appearing in the resident selector
- **THEN** it stays visible in the admin list with an archived badge
- **AND** restoring it makes it selectable again

#### Scenario: Delete only when unused

- **WHEN** the admin deletes a destination that has never been used by a pass
- **THEN** the row is removed
- **WHEN** the admin deletes a destination that appears in at least one pass
- **THEN** the API responds with status 409 and the UI offers to archive it instead

#### Scenario: Missing permission

- **WHEN** a `guard` or `operator` calls the destination endpoints
- **THEN** the response has status 403

#### Scenario: Other organization

- **WHEN** an admin of another organization edits or archives a destination
- **THEN** the response has status 404

### Requirement: Destination selection in the pass form

The create-pass form SHALL let the resident pick a destination before entering visitor data.

#### Scenario: Grouped options

- **WHEN** the resident opens the destination selector
- **THEN** the first option is `Mi vivienda` with the resolved unit path
- **THEN** the remaining options are grouped by kind with the destination name
- **AND** archived destinations are excluded

#### Scenario: Multiple units

- **WHEN** the resident has more than one associated leaf unit
- **THEN** `Mi vivienda` expands into one option per unit showing its full path

#### Scenario: No common areas

- **WHEN** the community has no active destinations
- **THEN** only the home options are shown
- **AND** no empty group is rendered

#### Scenario: Destination summary before saving

- **WHEN** the resident reaches the confirmation step
- **THEN** the summary shows the visitor, the destination name, the validity window, and whether a vehicle is allowed
- **AND** the resident can go back without losing the entered data

### Requirement: Destination appears in pass reads

Every pass read SHALL expose a resolved destination label.

#### Scenario: Pass list payload

- **WHEN** `GET /api/passes` is called
- **THEN** each item includes `destination` with `id`, `name`, and `kind` for common areas
- **THEN** each item includes `locationPath` for home destinations
- **AND** exactly one of the two is non-null

#### Scenario: Guard scan

- **WHEN** a guard scans a pass whose destination is a common area
- **THEN** the scan response shows the destination name instead of a unit path
- **AND** the bitácora entry stores the destination name and kind

#### Scenario: Historical destination

- **WHEN** a pass references a destination that was later archived
- **THEN** the pass keeps rendering the destination name
- **AND** no pass is deleted or hidden
