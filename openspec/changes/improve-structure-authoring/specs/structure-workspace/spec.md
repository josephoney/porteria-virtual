## ADDED Requirements

### Requirement: Structure tab name

The structure workspace SHALL label its tree tab "Esquema".

#### Scenario: Tab label

- **WHEN** an admin opens Estructura
- **THEN** the tree tab reads "Esquema"
- **THEN** no visible label says "Árbol"

#### Scenario: Documentation and empty states

- **WHEN** a screen or message points to the tree
- **THEN** it says "Esquema" instead of "Árbol"

### Requirement: Node type per level

The node form SHALL label the type with the configured name of the level and offer the
catalog that corresponds to it.

#### Scenario: Level 1 label

- **WHEN** the structure names level 1 "Torre"
- **THEN** the form label reads "Tipo de Torre"

#### Scenario: Level 2 label

- **WHEN** the structure names level 2 "Piso"
- **THEN** the form label reads "Tipo de Piso"
- **THEN** the options come from the level 2 and 3 catalog

#### Scenario: Custom type

- **WHEN** the admin chooses "Otro"
- **THEN** a text field asks for the custom name
- **THEN** the custom name is required to save

#### Scenario: Existing nodes

- **WHEN** a node has no type
- **THEN** the list shows "—" and does not force a type on edit

### Requirement: Branch depth when creating a level-1 node

The create form of a level-1 node SHALL let the admin choose whether the branch uses level
2 and level 3.

#### Scenario: Structure with three levels

- **WHEN** the structure defines three levels
- **THEN** the form shows "Usa nivel 2" and "Usa nivel 3", both checked by default

#### Scenario: Structure with two levels

- **WHEN** the structure defines two levels
- **THEN** only "Usa nivel 2" is offered
- **THEN** there is no level 3 option

#### Scenario: Single node branch

- **WHEN** the admin unchecks level 2
- **THEN** the created node is a leaf
- **THEN** the row does not offer to add children

#### Scenario: Reduce depth with children

- **WHEN** the admin edits a branch that already has children in a level that would be
  disabled
- **THEN** the response is `409 branch_has_deeper_children`
- **THEN** nothing changes

### Requirement: Generation entry point

The create dialog SHALL offer to create one node or several.

#### Scenario: Several

- **WHEN** the admin chooses "Varias"
- **THEN** the dialog asks for the numbering mode and its parameters
- **THEN** it shows a preview of the names before creating

#### Scenario: One

- **WHEN** the admin chooses "Una sola"
- **THEN** the dialog behaves as today
