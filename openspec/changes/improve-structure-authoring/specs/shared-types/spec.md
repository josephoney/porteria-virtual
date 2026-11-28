## ADDED Requirements

### Requirement: Node type catalogs

The shared package SHALL export the type catalogs for level 1 and for levels 2 and 3,
sorted alphabetically.

#### Scenario: Level 1 catalog

- **WHEN** a developer imports the level 1 catalog
- **THEN** it contains at least: Ala, Bloque, Edificio, Etapa, Interior, Manzana, Módulo,
  Núcleo, Pabellón, Piso, Sector, Torre, Unidad, Villa, Zona, Zona común
- **THEN** the entries are in alphabetical order
- **THEN** each entry has a stable identifier and a display label

#### Scenario: Levels 2 and 3 catalog

- **WHEN** a developer imports the levels 2 and 3 catalog
- **THEN** it contains at least: Apartamento, Bodega, Casa, Consultorio, Cuarto útil,
  Depósito, Habitación, Local, Lote, Oficina, Parqueadero, Suite, Terraza, Unidad
- **THEN** the entries are in alphabetical order

#### Scenario: Custom type

- **WHEN** the chosen type is `other`
- **THEN** the catalog exposes the "Otro" option with a free label

### Requirement: Generation DTOs

The shared package SHALL describe the generation request and its plan.

#### Scenario: Request

- **WHEN** a developer inspects the generation DTO
- **THEN** it includes `communityId`, `parentId`, `nodeType`, `branchLevelCount`, `mode`,
  the mode parameters and `dryRun`

#### Scenario: Plan

- **WHEN** the server returns a plan
- **THEN** it includes the nodes to create with level, name, parent reference and type
- **THEN** it includes the conflicts found, if any
- **THEN** it includes the total count

### Requirement: Pure generation planner

The shared package SHALL export a pure planner so the client and the server produce the
same names.

#### Scenario: Sequential mode

- **WHEN** the plan is requested with `count = 50`, prefix "Casa" and start 1
- **THEN** the names are `Casa 1` … `Casa 50`

#### Scenario: Floors mode

- **WHEN** the plan is requested with 5 floors and 6 units per floor
- **THEN** the level-2 names are `Piso 1` … `Piso 5`
- **THEN** the level-3 names are `101` … `106`, `201` … `206`, … `501` … `506`

#### Scenario: Padding

- **WHEN** the plan uses a padding of three digits
- **THEN** the numbers are formatted with leading zeros

#### Scenario: No I/O

- **WHEN** the planner is called
- **THEN** it performs no database or network access
- **THEN** the same input always produces the same output
