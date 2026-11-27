## ADDED Requirements

### Requirement: Create a unit from the units page

The units workspace SHALL let an authorized admin create a leaf unit from the list, without
navigating to the structure tree.

#### Scenario: Action availability

- **WHEN** an `org_admin` or `community_admin` opens `/admin/units`
- **THEN** the header offers "Nueva unidad"
- **WHEN** a platform administrator opens `/platform/units`
- **THEN** the action is not offered, because tenant data is read-only for it

#### Scenario: Community and section

- **WHEN** the structure of the selected community has two levels
- **THEN** the dialog asks for community, section, name and code
- **THEN** saving creates the unit under that section

#### Scenario: Intermediate levels

- **WHEN** the structure has three levels
- **THEN** the dialog asks for the second level as well
- **THEN** saving creates the unit under the node chosen in the last level before the leaf

#### Scenario: Single-level structure

- **WHEN** the structure has one level
- **THEN** the dialog creates the unit as a root node of that structure

#### Scenario: Created unit is visible

- **WHEN** the unit is created
- **THEN** the list refreshes without reloading the page
- **THEN** the new unit appears with its section and path

#### Scenario: Duplicate code

- **WHEN** the code already exists in the community
- **THEN** the dialog shows the server message and stays open

#### Scenario: Missing structure or parents

- **WHEN** the community has no structure, or the required parent level has no nodes
- **THEN** the dialog explains it and disables saving

### Requirement: Edit a unit from the units page

The units workspace SHALL let an authorized admin edit the name and the code of a unit.

#### Scenario: Edit action

- **WHEN** an admin chooses the edit action on a unit row
- **THEN** a dialog opens with the current name and code
- **THEN** saving calls `PATCH /api/location-units/:id` and refreshes the list without a
  page reload

#### Scenario: Empty name

- **WHEN** the name is blank
- **THEN** the dialog blocks the save and explains it inline

#### Scenario: Duplicate on edit

- **WHEN** the new name or code already exists among the siblings
- **THEN** the server responds `409`
- **THEN** the dialog shows the reason and stays open

### Requirement: Remove a unit with double confirmation

The units workspace SHALL let an authorized admin delete a unit only after two explicit
confirmations.

#### Scenario: First confirmation

- **WHEN** the admin chooses the delete action
- **THEN** a dialog explains that the unit is removed and the action cannot be undone
- **THEN** a "Continuar" action moves to the second step
- **THEN** nothing is deleted yet

#### Scenario: Second confirmation

- **WHEN** the admin confirms in the second step
- **THEN** `DELETE /api/location-units/:id` is called
- **THEN** the list refreshes

#### Scenario: Cancelling

- **WHEN** the admin closes the dialog at either step
- **THEN** the unit is not deleted

#### Scenario: Unit with residents or authorizations

- **WHEN** the server rejects the delete because the unit has residents, children or
  authorizations
- **THEN** the dialog shows the reason and suggests archiving instead

### Requirement: Unique names and codes among siblings

The system SHALL reject a node whose name or code repeats among its siblings.

#### Scenario: Duplicate unit name

- **WHEN** a unit is created or renamed with a name that already exists under the same
  parent, ignoring case and surrounding spaces
- **THEN** the response has status 409 with code `duplicate_name`
- **THEN** no second unit is created

#### Scenario: Duplicate section name

- **WHEN** a level-1 node is created with a name that already exists at that level
- **THEN** the response has status 409 with code `duplicate_name`

#### Scenario: Duplicate code

- **WHEN** the code already exists among the siblings
- **THEN** the response has status 409 with code `duplicate_code`
- **THEN** two nodes may still share a code in different sections

#### Scenario: Editing keeps the check

- **WHEN** a node is edited without changing its name or code
- **THEN** the check ignores the node itself
- **THEN** saving succeeds
