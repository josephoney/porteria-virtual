# structure-workspace Specification

## Purpose
TBD - created by archiving change nested-units-workspace. Update Purpose after archive.
## Requirements
### Requirement: Collapsible structure table

The structure dialog SHALL render the location tree as a collapsible table instead of cards.

#### Scenario: Initial state

- **WHEN** the dialog opens for a community with three levels
- **THEN** the rows for the first level are visible
- **THEN** deeper levels are collapsed

#### Scenario: Expand a level

- **WHEN** the user activates a first-level row
- **THEN** its second-level rows are shown indented
- **THEN** the row exposes its expanded state to assistive technology

#### Scenario: Deep nesting

- **WHEN** the user expands a second-level row
- **THEN** its third-level rows are shown

#### Scenario: Large structures

- **WHEN** the structure has many nodes
- **THEN** the table scrolls inside the dialog
- **THEN** the dialog header and the structure actions stay reachable

### Requirement: Read-only nodes

The structure dialog SHALL NOT create, rename, archive or delete nodes.

#### Scenario: No mutation actions

- **WHEN** the dialog is open
- **THEN** node rows show no edit, archive or delete actions
- **THEN** there is no add-node row

#### Scenario: Where to edit

- **WHEN** the dialog explains where nodes are managed
- **THEN** it points to the Unidades workspace

### Requirement: Structure definition

The dialog SHALL allow editing the structure definition while keeping the node tree read-only.

#### Scenario: Edit structure

- **WHEN** the user activates "Editar estructura"
- **THEN** a form opens with the level count and the level names
- **THEN** saving updates the definition
- **THEN** the table is re-rendered with the new names

#### Scenario: Level count reduction

- **WHEN** the user reduces the level count while nodes exist at the removed level
- **THEN** the API rejects the change or the UI prevents it
- **THEN** the user sees an explanation instead of a silent failure

### Requirement: Structure actions

The dialog SHALL expose the actions that belong to the definition, not to the nodes.

#### Scenario: Actions available

- **WHEN** the dialog is open
- **THEN** it offers "Editar estructura"
- **THEN** the summary block describes the current levels and totals

#### Scenario: Empty structure

- **WHEN** the community has no structure
- **THEN** the dialog offers to create it
- **THEN** the table area is replaced by the empty state

