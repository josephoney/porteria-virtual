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
