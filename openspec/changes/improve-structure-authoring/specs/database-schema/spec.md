## ADDED Requirements

### Requirement: Branch depth column

`location_units` SHALL store the branch level count.

#### Scenario: Columns

- **WHEN** the schema is inspected
- **THEN** `location_units` includes `branch_level_count` (smallint, nullable)
- **THEN** `branch_level_count` is between 1 and 3 when present

#### Scenario: Backfill

- **WHEN** the migration runs on existing data
- **THEN** every node gets `branch_level_count = level_count` of its structure
- **THEN** the leaf behavior of existing nodes does not change

#### Scenario: Null means inherit

- **WHEN** a node has `branch_level_count = NULL`
- **THEN** readers fall back to the structure level count

### Requirement: Node type columns

`location_units` SHALL store a node type independent of the legacy section type.

#### Scenario: Columns

- **WHEN** the schema is inspected
- **THEN** `location_units` includes `node_type` (text, nullable) and
  `node_type_label` (text, nullable)

#### Scenario: Legacy backfill

- **WHEN** the migration runs
- **THEN** level-1 nodes copy `section_type` into `node_type` and `section_type_label` into
  `node_type_label`
- **THEN** `section_type` remains readable for compatibility

#### Scenario: No destructive change

- **WHEN** the migration runs
- **THEN** no existing column is dropped or rewritten in place
