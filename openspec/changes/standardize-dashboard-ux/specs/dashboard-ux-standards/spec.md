## ADDED Requirements

### Requirement: Dashboard layout

The dashboard SHALL provide a consistent shell.

#### Scenario: Desktop
- **WHEN** the viewport is `lg` or larger
- **THEN** the sidebar is visible and the top bar shows user, context and logout

#### Scenario: Mobile
- **WHEN** the viewport is smaller than `lg`
- **THEN** the sidebar collapses into a sheet/drawer
- **THEN** content uses the full width

#### Scenario: Navigation
- **WHEN** the active route changes
- **THEN** the sidebar highlights the matching item
- **THEN** only allowed items for the role/context are shown

### Requirement: Forms

Forms SHALL follow a consistent structure.

#### Scenario: Field structure
- **WHEN** a form field is rendered
- **THEN** it has a label, control, and optional help/error text
- **THEN** the error is announced to assistive tech

#### Scenario: Validation
- **WHEN** a field is invalid
- **THEN** it shows an inline error and the submit button is disabled or reports the error

#### Scenario: Destructive confirmation
- **WHEN** the user performs a destructive action
- **THEN** a confirmation dialog is shown

### Requirement: Tables

Tables SHALL handle data states consistently.

#### Scenario: Loading
- **WHEN** data is loading
- **THEN** a skeleton or spinner is shown

#### Scenario: Empty
- **WHEN** there are no rows
- **THEN** an empty state with a clear message is shown

#### Scenario: Error
- **WHEN** the request fails
- **THEN** an error state with retry is shown

#### Scenario: Pagination
- **WHEN** there are more rows than the page size
- **THEN** pagination controls show page/total

### Requirement: Cards and metrics

Cards SHALL have a consistent hierarchy.

#### Scenario: Metric card
- **WHEN** a metric is rendered
- **THEN** it shows a label, value, and optional trend
- **THEN** it uses the same spacing/typography as other cards

#### Scenario: Content card
- **WHEN** a content card is rendered
- **THEN** header, body and actions are clearly separated

### Requirement: Modals and sheets

Overlays SHALL behave consistently.

#### Scenario: Dialog
- **WHEN** a dialog opens
- **THEN** focus moves inside and returns on close
- **THEN** Escape closes it

#### Scenario: Destructive dialog
- **WHEN** the dialog is destructive
- **THEN** the confirm button uses the destructive variant and states the consequence

### Requirement: Buttons

Buttons SHALL use a small set of variants.

#### Scenario: Variants
- **WHEN** a button is rendered
- **THEN** it uses `default`, `secondary`, `outline`, `ghost`, or `destructive`
- **THEN** it has a clear label or `aria-label`

#### Scenario: Pending state
- **WHEN** a button triggers an async action
- **THEN** it shows a loading state and prevents double submit

### Requirement: Responsive and accessible

Screens SHALL work on mobile and be accessible.

#### Scenario: Responsive table
- **WHEN** a table is rendered on a small screen
- **THEN** it scrolls horizontally or becomes cards

#### Scenario: Keyboard
- **WHEN** the user navigates with the keyboard
- **THEN** all interactive elements are reachable with a visible focus

#### Scenario: Contrast
- **WHEN** text is rendered
- **THEN** it meets AA contrast against its background
