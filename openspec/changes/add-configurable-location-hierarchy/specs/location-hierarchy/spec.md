## ADDED Requirements

### Requirement: Location structures

Each community SHALL define one or more location structures with 1–3 customizable levels.

#### Scenario: Create structure
- **WHEN** a community admin creates a structure with `name`, `levelCount`, and level names
- **THEN** the structure is persisted with unique level names within it
- **THEN** `levelCount` is 1, 2, or 3

#### Scenario: Multiple structures
- **WHEN** a community needs a residential and a commercial structure
- **THEN** it can create two structures with different level names
- **THEN** each structure has its own nodes

#### Scenario: Rename levels
- **WHEN** an admin renames a level
- **THEN** the name changes without affecting nodes or residents

### Requirement: Section catalog

Root location groups SHALL be exposed as Sections with a semantic type.

#### Scenario: Create section
- **WHEN** an admin creates a root node with `name`, `code`, and `sectionType`
- **THEN** it is stored at `levelPosition = 1`
- **THEN** `sectionType` is one of `tower`, `interior`, `building`, `zone`, `block`,
  `sector`, `floor`, `house`, `lot`, `commercial`, or `other`

#### Scenario: Custom type
- **WHEN** `sectionType = 'other'`
- **THEN** `sectionTypeLabel` is required
- **THEN** the label is shown instead of the generic type label

#### Scenario: Type does not constrain hierarchy
- **WHEN** a section has `sectionType = 'zone'`
- **THEN** it can still have the same number of levels and child nodes as any other
  section
- **THEN** the type does not change parent/child or level rules

#### Scenario: Type is editable
- **WHEN** an admin changes a section's type
- **THEN** the hierarchy, children, units and residents remain unchanged

#### Scenario: Section listing
- **WHEN** an authorized user lists sections with optional `communityId`, `type`, or
  search
- **THEN** the response is paginated with id, name, code, section type, community,
  level count, unit count and status
- **THEN** results are scoped to the caller's organization/community

### Requirement: Generic location nodes

Nodes SHALL be generic and hierarchical. Intermediate nodes have no rigid type; root
sections carry a semantic section type.

#### Scenario: Create root node
- **WHEN** a node is created without `parentId`
- **THEN** it is a section at `levelPosition = 1`
- **THEN** it includes a valid `sectionType`

#### Scenario: Create child node
- **WHEN** a node is created with a parent
- **THEN** its `levelPosition = parent.levelPosition + 1`
- **THEN** its `structureId` matches the parent

#### Scenario: Custom names
- **WHEN** a structure defines “Sector → Manzana → Casa”
- **THEN** the nodes use those names, not hardcoded types

#### Scenario: Unit/leaf
- **WHEN** `levelPosition = levelCount`
- **THEN** the node is treated as a unit and can have residents

### Requirement: Hierarchy constraints

The system SHALL enforce hierarchy integrity.

#### Scenario: Invalid parent
- **WHEN** a node's parent belongs to another structure
- **THEN** the request is rejected with 400

#### Scenario: Cycle
- **WHEN** a move would create a cycle
- **THEN** the request is rejected with 400

#### Scenario: Delete with children
- **WHEN** a node with children is deleted
- **THEN** the request is rejected with 409

#### Scenario: Unique code
- **WHEN** two siblings have the same code
- **THEN** the database rejects the duplicate

### Requirement: Reorganize without data loss

The system SHALL allow safe reorganization.

#### Scenario: Move node
- **WHEN** a node is moved within the same structure to a valid parent
- **THEN** its subtree moves with it
- **THEN** residents and references remain

#### Scenario: Expand levels
- **WHEN** `levelCount` increases
- **THEN** existing nodes keep their positions

#### Scenario: Reduce levels
- **WHEN** `levelCount` decreases but the removed level has nodes
- **THEN** the request is rejected with 409

### Requirement: Resident associations

Residents SHALL be associated to one or more units.

#### Scenario: Associate resident
- **WHEN** a person is associated to a unit
- **THEN** the association stores relationship, validity and status

#### Scenario: Multiple units
- **WHEN** a person owns two units
- **THEN** both associations are allowed

#### Scenario: Multiple residents
- **WHEN** a unit has several residents
- **THEN** all associations are allowed

#### Scenario: End association
- **WHEN** an association is ended
- **THEN** it is marked inactive/ended and the history is preserved

### Requirement: Location API

The API SHALL expose structure, section and node management.

#### Scenario: Structure CRUD
- **WHEN** an authorized user calls the structure endpoints
- **THEN** create/read/update are scoped to their community

#### Scenario: Section CRUD
- **WHEN** an authorized user calls the section endpoints
- **THEN** create/read/update enforce the section type catalog and community scope

#### Scenario: Node CRUD
- **WHEN** an authorized user creates/moves/deletes nodes
- **THEN** the hierarchy constraints are enforced

#### Scenario: Cross-tenant access
- **WHEN** a user accesses a structure, section or node of another community
- **THEN** the response is 403/404

### Requirement: Migration from fixed units

The migration SHALL preserve existing building/unit data.

#### Scenario: Buildings become sections
- **WHEN** the migration runs
- **THEN** each `building` becomes a level 1 section with `sectionType = 'building'`
- **THEN** its name, code and floor count are preserved
- **THEN** an admin can change the section type without moving its units

#### Scenario: Floors become level 2
- **WHEN** units have a floor
- **THEN** a level 2 “Piso {n}” node is created or reused

#### Scenario: Units become level 3
- **WHEN** the migration runs
- **THEN** each `unit` becomes a level 3 node
- **THEN** its code is preserved

#### Scenario: Idempotency
- **WHEN** the migration runs twice
- **THEN** it does not duplicate structures or nodes
