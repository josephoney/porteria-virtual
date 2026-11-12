## ADDED Requirements

### Requirement: Destinations are location nodes

Every pass destination SHALL be a node of the community location tree, so there is a single hierarchy for residences and common areas.

#### Scenario: Pass target columns

- **WHEN** a pass is created for any destination
- **THEN** it stores `location_unit_id` with the destination node
- **THEN** it stores the `structure_id` that node belongs to
- **AND** both columns stay `NOT NULL`
- **AND** no second destination column exists

#### Scenario: Home destination

- **WHEN** the resident chooses their home
- **THEN** the destination node is a leaf of the structure
- **THEN** the node is not inside a common-area section

#### Scenario: Common area destination

- **WHEN** the resident chooses a common area
- **THEN** the destination node belongs to a section typed `common_area`
- **THEN** the node may be internal, because a common area does not need a third level

#### Scenario: No parallel catalog

- **WHEN** the schema is inspected
- **THEN** there is no `community_destinations` table and no `destination_id` column
- **AND** the only source of destinations is `location_units`

### Requirement: Common-area sections

A level-1 node typed `common_area` SHALL mark its branch as authorizable places.

#### Scenario: Section type value

- **WHEN** the migration is applied
- **THEN** `section_type` accepts `common_area`
- **THEN** the admin UI labels it `Zona común`

#### Scenario: Branch descendants

- **WHEN** a section is typed `common_area`
- **THEN** every active node in its subtree is an authorizable destination
- **THEN** each node keeps its own name, so `Piscina` and `Club social` are separate destinations
- **THEN** the section root itself is authorizable only when it has no children

#### Scenario: Classification

- **WHEN** the API classifies a destination
- **THEN** it walks up to the level-1 ancestor
- **THEN** the destination kind is `common_area` when that ancestor has `section_type = 'common_area'`
- **THEN** otherwise the kind is `home`

#### Scenario: Archived or inactive nodes

- **WHEN** the resident tries to authorize a destination whose node or level-1 ancestor is archived
- **THEN** the API responds with status 400 and reason `destination_inactive`
- **AND** existing passes for that node are unaffected

#### Scenario: Missing structure

- **WHEN** the community has no structure
- **THEN** only the home destination is offered
- **AND** the interface invites the admin to define the structure

### Requirement: Common areas are authored from Unidades

The admin SHALL create and maintain common areas with the same tree tools already used for towers and floors.

#### Scenario: Create a common-area branch

- **WHEN** the admin adds a level-1 element in `Unidades`
- **THEN** the form asks for a section type
- **THEN** `Zona común` is one of the options
- **AND** saving the element creates the branch in the same table

#### Scenario: Create the places inside the branch

- **WHEN** the admin expands a common-area section and adds a child
- **THEN** the child is created with the next level name of the structure
- **AND** the child appears without reloading the page

#### Scenario: Rename and archive

- **WHEN** the admin renames a common area
- **THEN** future passes and reads show the new name
- **WHEN** the admin archives a common area
- **THEN** it stops appearing in the resident selector
- **AND** it remains visible in `Unidades` with an archived badge

#### Scenario: Delete in use

- **WHEN** the admin deletes a node referenced by at least one pass
- **THEN** the API responds with status 409 and the interface offers to archive it instead

#### Scenario: No new menu

- **WHEN** the admin wants to manage common areas
- **THEN** the entry point is `Unidades`
- **AND** no separate catalog menu or community-detail block exists

### Requirement: Destination selection in the pass form

The create-pass form SHALL let the resident pick the destination before entering visitor data.

#### Scenario: Grouped options

- **WHEN** the resident opens the destination selector
- **THEN** the first group is `Mi vivienda` with each associated unit path
- **THEN** the second group is `Zonas comunes` with every authorizable node of the community
- **AND** archived nodes are excluded

#### Scenario: Path labels

- **WHEN** an option is rendered
- **THEN** it shows the full path from the level-1 section to the node, separated by `›`

#### Scenario: Multiple residences

- **WHEN** the resident has more than one associated leaf unit
- **THEN** `Mi vivienda` lists one option per unit with its full path

#### Scenario: No common areas

- **WHEN** the community has no active common-area section
- **THEN** only the home group is shown
- **AND** no empty group is rendered

#### Scenario: Destination summary

- **WHEN** the resident reaches the confirmation step
- **THEN** the summary shows the visitor, the destination path, the validity window, and whether a vehicle is allowed
- **AND** the resident can go back without losing the entered data

### Requirement: Destination appears in pass reads

Every pass read SHALL expose the resolved destination.

#### Scenario: Pass list payload

- **WHEN** `GET /api/passes` is called
- **THEN** each item includes `destination` with `id`, `name`, `path`, and `kind`
- **THEN** `kind` is `home` or `common_area`

#### Scenario: Guard scan

- **WHEN** a guard scans a pass
- **THEN** the scan response shows the destination path
- **AND** the bitácora entry stores the destination name and kind

#### Scenario: Historical destination

- **WHEN** a pass references a node that was later archived
- **THEN** the pass keeps rendering the name and path
- **AND** no pass is deleted or hidden
