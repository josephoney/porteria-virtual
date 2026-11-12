# detail-card-consistency Specification

## Purpose
TBD - created by archiving change polish-admin-workspace. Update Purpose after archive.
## Requirements
### Requirement: Shared detail field

Expandable detail cards MUST render label and value pairs through the shared `DetailGrid` and `DetailField` components.

#### Scenario: Standard field

- **WHEN** a detail card renders a field
- **THEN** the label uses `text-xs font-medium uppercase tracking-wider text-muted-foreground`
- **THEN** the value uses `text-sm font-medium text-foreground`
- **THEN** the value does not repeat the label as a prefix

#### Scenario: Layout

- **WHEN** the viewport is desktop
- **THEN** fields are laid out in two columns with vertical spacing
- **WHEN** the viewport is mobile
- **THEN** fields stack in a single column
- **THEN** long fields such as address or welcome message span the full width

#### Scenario: Missing value

- **WHEN** a field has no value
- **THEN** it renders “—” instead of an empty line

#### Scenario: Coverage

- **WHEN** a detail card is rendered for an organization, a community or a person
- **THEN** it uses `DetailGrid` and `DetailField`, not ad hoc markup

### Requirement: Row click expands details

Tables with a detail panel MUST expand on row click and MUST NOT require a dedicated detail button.

#### Scenario: Expand and collapse

- **WHEN** the user clicks a row
- **THEN** the detail panel opens below the row
- **WHEN** the user clicks the same row again
- **THEN** the detail panel closes

#### Scenario: Keyboard

- **WHEN** the row has focus and the user presses Enter or Space
- **THEN** the detail panel toggles
- **THEN** the row exposes `aria-expanded`

#### Scenario: Single open row

- **WHEN** the user expands another row
- **THEN** the previously expanded row collapses

#### Scenario: Actions do not toggle

- **WHEN** the user clicks “Editar”, “Invitar admin”, “Ver estructura” or a status toggle inside a row
- **THEN** the action runs
- **THEN** the row expansion does not change

#### Scenario: No detail button

- **WHEN** the organizations table of the platform console is rendered
- **THEN** no “Ver detalle” or “Ocultar detalle” button is present

### Requirement: Community edit from the row

The communities table MUST expose an “Editar” action that opens the community form in edit mode.

#### Scenario: Edit an existing community

- **WHEN** an `org_admin` or `community_admin` clicks “Editar” on a community
- **THEN** the form opens prefilled with the current values
- **THEN** saving sends `PATCH /api/communities/:id`
- **THEN** the row keeps its previous expansion state

#### Scenario: Scope enforcement

- **WHEN** a `community_admin` edits a community outside their scope
- **THEN** the API rejects the request with 403 and the form shows the error

