# location-structure-singleton Specification

## Purpose
TBD - created by archiving change single-location-structure. Update Purpose after archive.
## Requirements
### Requirement: One structure per community

A community MUST have at most one location structure definition.

#### Scenario: Community without a structure

- **WHEN** an administrator opens the structure dialog for a community with no `location_structures` row
- **THEN** the dialog shows “Sin estructura definida” and a “Definir estructura” action.

#### Scenario: Community with a structure

- **WHEN** an administrator opens the structure dialog for a community with one structure
- **THEN** the dialog shows one header “Estructura de la comunidad”, the level summary and one “Editar estructura” action.

#### Scenario: Attempt to create a second structure

- **WHEN** a client sends `POST /api/location-structures` for a community that already has a structure
- **THEN** the API responds `409` with `message: "structure_already_exists"` and does not create a row.

### Requirement: Migration merges existing structures

Existing communities with multiple structures MUST be merged into one primary structure without losing units or historical references.

#### Scenario: Secondary structure with units

- **WHEN** the migration processes a secondary structure with location units
- **THEN** every unit keeps its `parent_id`, `level_position`, `name`, `code`, `section_type`, `section_type_label`, `metadata` and `status`, and its `structure_id` becomes the primary structure id.

#### Scenario: Secondary structure referenced by passes or scans

- **WHEN** an access pass or pass scan references a secondary structure
- **THEN** its `structure_id` is updated to the primary before the secondary row is deleted.

#### Scenario: Primary selection

- **WHEN** a community has multiple structures
- **THEN** the primary is the structure named “Estructura principal” when it exists; otherwise the one with the most units, then the oldest structure.

### Requirement: Level definition validation

The single structure MUST define between one and three levels and the name of every existing level.

#### Scenario: Valid levels

- **WHEN** an administrator saves `levelCount` 1–3 with `level1Name` and the names for each existing level
- **THEN** the structure is updated.

#### Scenario: Missing level name

- **WHEN** the request omits a level name that is required by `levelCount`
- **THEN** the API responds `400` with a validation error.

#### Scenario: Reducing levels with existing units

- **WHEN** an administrator reduces `levelCount` while units exist at the removed level or deeper
- **THEN** the API responds `409` with `message: "structure_has_units_at_removed_level"` and the structure is unchanged.

### Requirement: Single-header structure dialog

The structure dialog MUST present one structure definition, not one card per structure row.

#### Scenario: Render roots

- **WHEN** the dialog opens for a community with a structure
- **THEN** it renders one header, one level summary, one “Editar estructura” button, one root action using `level1Name`, and the level-1 nodes with their descendants.

#### Scenario: No duplicate edit actions

- **WHEN** the dialog renders
- **THEN** there is exactly one “Editar estructura” action in the dialog.

### Requirement: Structure summary in community detail

The community overview API MUST expose a structure summary for the expanded community row.

#### Scenario: Uniform structure

- **WHEN** every level-1 node has the same number of level-2 children and every level-2 node has the same number of leaves
- **THEN** `structureSummary.uniform` is true and the UI shows “3 torres de 5 pisos, 3 apartamentos por piso. 45 apartamentos en total.” using the configured level names and counts.

#### Scenario: Non-uniform structure

- **WHEN** the counts differ between branches
- **THEN** `structureSummary.uniform` is false and the UI shows “3 torres · 15 pisos · 45 unidades”.

#### Scenario: No structure

- **WHEN** the community has no structure
- **THEN** `structureSummary` is null and the expanded row shows “Sin estructura definida” with “Definir estructura”.

