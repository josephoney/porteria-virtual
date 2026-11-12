## ADDED Requirements

### Requirement: Community creation without reload

Creating a community SHALL add its row to the table in the same session.

#### Scenario: Successful creation

- **WHEN** the admin saves a new community
- **THEN** the dialog closes
- **THEN** the new community appears in the table
- **THEN** the page is not reloaded

#### Scenario: Workspace identity

- **WHEN** the new community is created
- **THEN** the workspace context refreshes
- **THEN** the sidebar reflects the updated workspace when applicable

#### Scenario: Partial data failure

- **WHEN** one of the auxiliary requests fails while the communities request succeeds
- **THEN** the community table is still rendered with its rows
- **THEN** the failure is reported inline without emptying the table

### Requirement: Icon actions

The communities table SHALL expose its row actions as icon buttons with accessible names.

#### Scenario: Actions column

- **WHEN** a community row is rendered
- **THEN** the actions column shows an edit action, a structure action and an invite-administrator action
- **THEN** each action has an accessible name and a tooltip

#### Scenario: Edit action

- **WHEN** the user activates edit
- **THEN** the community form opens prefilled
- **THEN** the row remains expanded if it was expanded

#### Scenario: Structure action

- **WHEN** the user activates structure
- **THEN** the structure dialog opens for that community

#### Scenario: Invite action

- **WHEN** the user activates invite administrator
- **THEN** the invitation flow starts for that community

### Requirement: Expanded community detail

Clicking a community row SHALL expand its detail without navigating away.

#### Scenario: Row expansion

- **WHEN** the user clicks a community row
- **THEN** the detail expands below it
- **THEN** clicking again collapses it

#### Scenario: Detail content

- **WHEN** the detail is expanded
- **THEN** it shows the community data, its geography and its administrator
- **THEN** it shows a summary of the configured structure
- **THEN** the summary uses the configured level names

#### Scenario: Keyboard

- **WHEN** the row toggle receives focus and the user presses Enter or Space
- **THEN** the detail toggles

### Requirement: Structure summary reflects the definition

The expanded detail SHALL describe the structure that is currently configured.

#### Scenario: Structure exists

- **WHEN** the community has a structure with nodes
- **THEN** the summary states the number of nodes per level using their names
- **THEN** it states the total number of leaf units

#### Scenario: Structure missing

- **WHEN** the community has no structure
- **THEN** the detail offers an action to define it
