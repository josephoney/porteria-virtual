## ADDED Requirements

### Requirement: Branch level count

The system SHALL let each level-1 node declare how many levels its branch uses, up to the
structure maximum.

#### Scenario: Create a two-level branch

- **WHEN** a level-1 node is created with `branchLevelCount = 2` in a three-level structure
- **THEN** the node stores `branch_level_count = 2`
- **THEN** its level-2 children inherit `branch_level_count = 2`
- **THEN** level-3 children are rejected under that branch

#### Scenario: Create a three-level branch

- **WHEN** a level-1 node is created with `branchLevelCount = 3`
- **THEN** the branch accepts level-2 and level-3 children

#### Scenario: Branch depth above the structure maximum

- **WHEN** a node is created with `branchLevelCount` greater than the structure level count
- **THEN** the response is `400`
- **THEN** no node is created

#### Scenario: Depth cannot be reduced below existing children

- **WHEN** a branch with level-3 children is changed to two levels
- **THEN** the response is `409 branch_has_deeper_children`
- **THEN** the branch keeps its depth

### Requirement: Leaf resolution

A node SHALL be a leaf when its level equals the branch level count.

#### Scenario: Three-level branch

- **WHEN** a node sits at level 3 of a three-level branch
- **THEN** it is a leaf
- **WHEN** a node sits at level 2 of that branch
- **THEN** it is not a leaf

#### Scenario: Two-level branch

- **WHEN** a node sits at level 2 of a two-level branch
- **THEN** it is a leaf
- **WHEN** a node sits at level 1 of a one-level branch
- **THEN** it is a leaf

#### Scenario: Occupant and pass validation follow the branch

- **WHEN** a pass or an occupant membership targets a node
- **THEN** the leaf check uses the branch level count, not the structure level count

### Requirement: Node type per level

Every node SHALL be able to store a type from the catalog of its level.

#### Scenario: Level 1 catalog

- **WHEN** a level-1 node is created or edited
- **THEN** its type comes from the level 1 catalog

#### Scenario: Levels 2 and 3 catalog

- **WHEN** a level-2 or level-3 node is created or edited
- **THEN** its type comes from the levels 2 and 3 catalog

#### Scenario: Optional type

- **WHEN** the type is omitted
- **THEN** the node is created without type
- **THEN** the catalog is not enforced retroactively on existing nodes

#### Scenario: Custom type

- **WHEN** the type is `other`
- **THEN** the node stores the custom label alongside it
