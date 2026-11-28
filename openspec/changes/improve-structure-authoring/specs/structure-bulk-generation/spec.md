## ADDED Requirements

### Requirement: Generation request

The API SHALL accept a generation request for nodes under a community, either at level 1 or
under an existing parent.

#### Scenario: Under a level-1 node

- **WHEN** a generation request names a level-1 parent in a three-level branch
- **THEN** the plan contains level-2 and level-3 nodes according to the mode

#### Scenario: Creating the section and its content in one step

- **WHEN** the request has no parent, a name and a branch depth of two or more
- **THEN** the section is created first
- **THEN** the planned nodes hang from it
- **THEN** the preview counts the section as the first node
- **THEN** the section name is checked against the existing sections

#### Scenario: Under a level-2 node

- **WHEN** a generation request names a level-2 parent
- **THEN** the plan contains only level-3 nodes

#### Scenario: Branch without room

- **WHEN** the parent cannot accept children because the branch ended
- **THEN** the response is `400`
- **THEN** nothing is created

#### Scenario: Depth beyond the structure

- **WHEN** the request would create a level deeper than the structure maximum
- **THEN** the response is `400`

### Requirement: Generation modes

The API SHALL support sequential and floor-based numbering.

#### Scenario: Sequential

- **WHEN** the request uses the sequential mode with a count, a prefix and a start number
- **THEN** the names are the prefix followed by consecutive numbers
- **THEN** a padding formats the number with leading zeros

#### Scenario: Floors

- **WHEN** the request uses the floors mode with a floor count and units per floor
- **THEN** one level-2 node is planned per floor
- **THEN** units per floor are named with the floor and the unit number, for example `101`
  through `106`
- **THEN** the next floor continues the series, for example `201` through `206`

#### Scenario: Limits

- **WHEN** the request exceeds 300 nodes, 50 floors or 50 units per floor
- **THEN** the response is `400`
- **THEN** the message states the limit that was exceeded

### Requirement: Preview before creating

The API SHALL return the plan without writing when `dryRun` is true.

#### Scenario: Dry run

- **WHEN** the request has `dryRun: true`
- **THEN** the response contains the planned names, levels and parents
- **THEN** no node and no audit event are written

#### Scenario: Conflicts in the plan

- **WHEN** a planned name already exists among the siblings
- **THEN** the response lists up to five conflicting names
- **THEN** the plan is marked as not applicable

### Requirement: Atomic creation

The API SHALL create the whole plan or nothing.

#### Scenario: Success

- **WHEN** a request with `dryRun: false` passes validation
- **THEN** every planned node is inserted in one transaction
- **THEN** one `location_node.bulk_created` event records the count and the parent
- **THEN** the response contains the created nodes

#### Scenario: Conflict at insert time

- **WHEN** one planned name collides with an existing sibling
- **THEN** the transaction rolls back
- **THEN** no node of the plan remains

#### Scenario: Permission

- **WHEN** the actor cannot write locations in that community
- **THEN** the response is `403`
- **THEN** no plan is executed

#### Scenario: Platform administrator

- **WHEN** a platform administrator calls the endpoint
- **THEN** the response is `403`
