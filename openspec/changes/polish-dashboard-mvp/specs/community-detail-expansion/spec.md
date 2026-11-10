## ADDED Requirements

### Requirement: Expandable community rows

The communities table SHALL expand and collapse the detail by clicking the row, without a separate “Detalle” button.

#### Scenario: Expand a community

- **WHEN** the admin clicks a community row
- **THEN** the row expands and shows the community detail
- **AND** the chevron indicates the expanded state

#### Scenario: Collapse a community

- **WHEN** the admin clicks the same expanded row
- **THEN** the detail collapses
- **AND** the chevron returns to the collapsed state

#### Scenario: One expanded community

- **WHEN** the admin expands another community
- **THEN** the previously expanded community collapses

### Requirement: Row actions do not toggle expansion

The “Invitar admin” and “Ver estructura” actions SHALL NOT toggle the row expansion.

#### Scenario: Action button click

- **WHEN** the admin clicks “Invitar admin” or “Ver estructura”
- **THEN** the action runs
- **AND** the row expansion state does not change

### Requirement: Keyboard-accessible expansion

The community row SHALL be operable with the keyboard.

#### Scenario: Keyboard toggle

- **WHEN** the row is focused and the admin presses Enter or Space
- **THEN** the row expands or collapses
- **AND** the row exposes `aria-expanded`

### Requirement: Structure summary in the expanded detail

The expanded community detail SHALL include a summary of the community structure.

#### Scenario: Uniform structure

- **WHEN** every level-1 node has the same number of level-2 nodes and every level-2 node has the same number of leaves
- **THEN** the detail shows a sentence such as “3 torres de 5 pisos, 3 apartamentos por piso. 45 apartamentos en total.”

#### Scenario: Non-uniform structure

- **WHEN** the structure exists but the counts are not uniform
- **THEN** the detail shows a fallback such as “3 torres · 15 pisos · 45 unidades”

#### Scenario: No structure

- **WHEN** the community has no structure
- **THEN** the detail shows “Sin estructura definida”
- **AND** offers “Definir estructura”

### Requirement: Community overview exposes the structure summary

`GET /api/communities/:id/overview` SHALL return the structure summary used by the detail.

#### Scenario: Summary payload

- **WHEN** the client requests the community overview
- **THEN** the response includes `structureSummary` with `structureId`, `levelCount`, `levelNames`, `level1Count`, `level2Count`, `leafCount`, `uniform`, `perLevel1` and `perLevel2`
- **AND** `structureSummary` is `null` when the community has no structure
