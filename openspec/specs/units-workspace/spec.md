# units-workspace Specification

## Purpose
TBD - created by archiving change nested-units-workspace. Update Purpose after archive.
## Requirements
### Requirement: Single Units entry point

The admin workspace SHALL expose a single "Unidades" section for the location tree, replacing the separate "Secciones" and "Unidades" sections.

#### Scenario: Sidebar menu

- **WHEN** an `org_admin` or `community_admin` opens the sidebar
- **THEN** the location menu shows a single "Unidades" entry
- **THEN** there is no "Secciones" entry

#### Scenario: Legacy route

- **WHEN** the user navigates to `/admin/sections` or `/platform/sections`
- **THEN** the app redirects to `/admin/units` or `/platform/units` respectively
- **THEN** the page renders the units workspace

#### Scenario: Section label

- **WHEN** the units workspace is active
- **THEN** the header shows "Unidades"

### Requirement: Community selector

The workspace SHALL show the tree of one community at a time.

#### Scenario: Multiple communities

- **WHEN** the user belongs to more than one community
- **THEN** a community selector is shown above the table
- **THEN** changing the selection loads that community's tree
- **THEN** the last selection is restored on the next visit

#### Scenario: Single community

- **WHEN** the user belongs to exactly one community
- **THEN** the selector shows that community in a non-interactive state
- **THEN** the tree is loaded without requiring a selection

### Requirement: Nested levels

The workspace SHALL render the structure as a table nested by level.

#### Scenario: First level visible

- **WHEN** the workspace loads a community with a structure
- **THEN** one row per level-1 node is shown
- **THEN** each row shows its name, its descendant summary and its status

#### Scenario: Expand and collapse

- **WHEN** the user activates the toggle of a level-1 row
- **THEN** its level-2 children are rendered as indented rows below it
- **THEN** activating the toggle again hides them

#### Scenario: Multiple branches

- **WHEN** the user expands two different level-1 rows
- **THEN** both remain expanded

#### Scenario: Three levels

- **WHEN** the structure has three levels and the user expands a level-2 row
- **THEN** its level-3 children are rendered

#### Scenario: One level

- **WHEN** the structure has a single level
- **THEN** no row has an expansion toggle
- **THEN** each level-1 row exposes the leaf actions

### Requirement: Inline creation at the end of each level

The workspace SHALL offer a creation row at the end of every expanded group, labelled with the configured level name.

#### Scenario: Add level-1 node

- **WHEN** the tree is rendered
- **THEN** the last row offers "Agregar {level1Name}"
- **THEN** activating it opens a form for a root node of that structure

#### Scenario: Add child node

- **WHEN** the structure has more levels and a node is expanded
- **THEN** the last row of that group offers "Agregar {childLevelName}"
- **THEN** saving creates the node under that parent

#### Scenario: Created row appears

- **WHEN** the creation form is saved successfully
- **THEN** the new row is visible in the tree without reloading the page
- **THEN** the parent branch remains expanded

### Requirement: Node actions by level

Each row SHALL expose the actions valid for its level.

#### Scenario: Branch actions

- **WHEN** a node has children
- **THEN** it offers edit and archive
- **THEN** delete is disabled and explains that the node has children

#### Scenario: Leaf actions

- **WHEN** a node is a leaf
- **THEN** it offers edit, archive and delete
- **THEN** it offers the residents action

#### Scenario: Delete confirmation

- **WHEN** the user selects delete on a leaf
- **THEN** a confirmation dialog names the node
- **THEN** confirming removes it and refreshes the tree

#### Scenario: Archive scope

- **WHEN** the user archives a node with descendants
- **THEN** the confirmation states how many nodes will be archived
- **THEN** the archived subtree is hidden or shown as archived consistently

### Requirement: Empty structure

The workspace SHALL guide the user when the community has no structure.

#### Scenario: No structure

- **WHEN** the selected community has no structure
- **THEN** an empty state explains that the structure is missing
- **THEN** it offers an action to define it

#### Scenario: Structure without nodes

- **WHEN** the structure exists but has no nodes
- **THEN** the table shows the "Agregar {level1Name}" row
- **THEN** no error is shown

