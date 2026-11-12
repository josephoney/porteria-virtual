## ADDED Requirements

### Requirement: Mutations refresh dependent views

A successful mutation SHALL make the affected views reflect the new state without a browser reload.

#### Scenario: Create community

- **WHEN** a community is created
- **THEN** the communities table shows it immediately
- **THEN** the workspace context is refreshed

#### Scenario: Edit community

- **WHEN** a community is edited
- **THEN** its row and its expanded detail show the saved values
- **THEN** a cached overview is not reused

#### Scenario: Structure changed elsewhere

- **WHEN** the user closes the structure dialog after changing the definition or its nodes
- **THEN** the communities table refreshes its structure summary
- **THEN** the units workspace reloads its tree

#### Scenario: No manual reload

- **WHEN** any of those mutations succeeds
- **THEN** the user does not need to refresh the browser to see the result

### Requirement: Resilient loading

Loading independent resources SHALL NOT fail as a whole when one of them fails.

#### Scenario: One request fails

- **WHEN** the admin panel loads several resources and one request fails
- **THEN** the resources that succeeded are rendered
- **THEN** the failure is reported inline for the affected section
- **THEN** the rest of the panel stays usable

#### Scenario: Section change

- **WHEN** the user navigates between admin sections
- **THEN** the data for the active section is available without a full page reload

### Requirement: Cache invalidation

Views that cache derived data SHALL invalidate it when the source changes.

#### Scenario: Expand after edit

- **WHEN** a community is edited while its row is expanded
- **THEN** the expanded detail is fetched again
- **THEN** it shows the new values

#### Scenario: Community switch

- **WHEN** the user switches the community in the units workspace
- **THEN** the previous community's tree is discarded from the view
- **THEN** the new tree is loaded from the API
