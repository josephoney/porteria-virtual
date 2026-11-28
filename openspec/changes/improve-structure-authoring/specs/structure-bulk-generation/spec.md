## ADDED Requirements

### Requirement: Generation by levels

The API SHALL accept a generation request that describes, level by level, how many nodes
to create and how to name them.

#### Scenario: Request shape

- **WHEN** a generation request is sent
- **THEN** it includes `communityId`, an optional `parentId` (or `structureId` for a root),
  and a `levels` array
- **THEN** each level includes `count`, an optional `prefix`, the sequence (`numbers` or
  `letters`) and an optional zero padding
- **THEN** the first level is always created; the following ones are optional and must be
  contiguous

#### Scenario: One level

- **WHEN** only one level is requested under an existing parent
- **THEN** the nodes are created at the parent's next level
- **THEN** their names are the prefix followed by the sequence value

#### Scenario: Several levels

- **WHEN** three levels are requested with counts 5, 6 and 5
- **THEN** five level-1 nodes are created
- **THEN** six children are created under each one
- **THEN** five grandchildren are created under each child
- **THEN** the total is 185 nodes

#### Scenario: Creating the first level without a parent

- **WHEN** the request has no parent and a structure
- **THEN** the first level of the plan is created as level 1
- **THEN** its depth comes from `branchLevelCount`
- **THEN** the names are checked against the existing level-1 nodes

#### Scenario: Depth limits

- **WHEN** the plan asks for more levels than the branch allows
- **THEN** the response is `400`
- **THEN** it names the error `invalid_params`

#### Scenario: Total limit

- **WHEN** the plan exceeds 300 nodes, or a level exceeds 100
- **THEN** the response is `400` with `limit_exceeded`
- **THEN** nothing is created

### Requirement: Sequences

Each level SHALL number its nodes with numbers or letters.

#### Scenario: Numbers

- **WHEN** a level uses numbers with a padding of two
- **THEN** the names are `Cuarto 01`, `Cuarto 02`, …

#### Scenario: Letters

- **WHEN** a level uses letters
- **THEN** the names are `Casa A`, `Casa B`, … and continue with `AA` after `Z`

### Requirement: Simplified names

The request SHALL be able to replace the composed names with a compact code.

#### Scenario: Default template

- **WHEN** `simplified` is true and no template is sent
- **THEN** the template is `{1}` for one level, `{1}-{2}` for two and `{1}-{2}{3}` for three

#### Scenario: Composite name and code

- **WHEN** a three-level plan is simplified with one sector, one house and five rooms padded
  to two digits
- **THEN** the room names are `1-101` … `1-105`
- **THEN** the code of each node equals its name

#### Scenario: Custom template

- **WHEN** the request sends a template such as `S{1}-C{2}`
- **THEN** the segments are replaced with the values of the path
- **THEN** the remaining text is kept as is

#### Scenario: Letters in the composite

- **WHEN** a level uses letters and the plan is simplified
- **THEN** the composite uses the letter, for example `1-A03`

### Requirement: Preview before creating

The API SHALL return the plan without writing when `dryRun` is true.

#### Scenario: Dry run

- **WHEN** the request has `dryRun: true`
- **THEN** the response contains the level, name, parent index and code of every planned
  node
- **THEN** it contains the total and the template used
- **THEN** no node and no audit event are written

#### Scenario: Conflicts

- **WHEN** a planned name of the first level already exists among its siblings
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

- **WHEN** a planned name collides with an existing sibling
- **THEN** the response is `409` with `duplicate_name`
- **THEN** the transaction rolls back and no node of the plan remains

#### Scenario: Permission

- **WHEN** the actor cannot write locations in that community
- **THEN** the response is `403`
- **THEN** a platform administrator also receives `403`
