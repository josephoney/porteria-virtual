## ADDED Requirements

### Requirement: Authorization history

The resident SHALL have a history of the authorizations they created.

#### Scenario: Columns

- **WHEN** the resident opens `/resident/authorizations`
- **THEN** the table shows `Visitante`, `Destino`, `Vigencia`, `Estado`, and `Acciones`
- **THEN** each visitor cell shows first and last name
- **THEN** each destination cell shows the full path from the level-1 section to the node
- **AND** common areas are visually distinguished from residences
- **THEN** each validity cell shows the start and end date and time

#### Scenario: Default order and pagination

- **WHEN** the history loads without filters
- **THEN** rows are ordered by `valid_from` descending
- **THEN** the page size is 10 and pagination is available when there are more rows

#### Scenario: Status values

- **WHEN** a row is rendered
- **THEN** the status badge is one of `Activa`, `Usada`, `Revocada`, or `Vencida`
- **THEN** `Vencida` is derived when `valid_until` is in the past and the status is still `active`

#### Scenario: Empty history

- **WHEN** the resident has no authorizations
- **THEN** the table shows an empty state with the `Autorizar visita` action
- **AND** no error message is displayed

#### Scenario: Load failure

- **WHEN** the history request fails
- **THEN** the page keeps the filters visible and shows a retry action
- **THEN** retrying re-issues the request without a page reload

### Requirement: History filters

The history SHALL support server-side filtering.

#### Scenario: Search by visitor

- **WHEN** the resident types a name or document in `Buscar autorizaciones`
- **THEN** the list shows only passes whose visitor first name, last name, or document contains the term, ignoring case
- **THEN** the result count reflects the filter

#### Scenario: Filter by status

- **WHEN** the resident selects a status
- **THEN** only passes with that status are listed

#### Scenario: Filter by destination

- **WHEN** the resident selects a destination
- **THEN** only passes for that destination are listed
- **AND** the selector includes destinations that are now archived but have passes

#### Scenario: Filter by batch

- **WHEN** the resident clicks the batch label of a row created in a bulk upload
- **THEN** the history filters by that `batch_id`
- **AND** the applied filter is visible and removable

#### Scenario: Clear filters

- **WHEN** the resident clears all filters
- **THEN** the full list returns to the first page

### Requirement: Pass actions from the history

Each row SHALL expose the actions allowed by the pass state.

#### Scenario: Active pass

- **WHEN** the pass status is `active`
- **THEN** the row offers `Ver QR`, `Copiar enlace`, `Regenerar enlace`, and `Revocar`
- **AND** each action has an `aria-label` that includes the visitor name

#### Scenario: Show QR

- **WHEN** the resident opens `Ver QR`
- **THEN** a dialog shows the rotating QR for that pass
- **THEN** the QR refreshes before its token expires while the dialog stays open
- **AND** closing the dialog stops the refresh

#### Scenario: Copy link

- **WHEN** the resident uses `Copiar enlace`
- **THEN** the public pass link is written to the clipboard
- **AND** a confirmation is shown

#### Scenario: Regenerate link

- **WHEN** the resident regenerates the link
- **THEN** the previous link stops working
- **AND** the new link is shown with the option to copy it

#### Scenario: Revoke

- **WHEN** the resident revokes an authorization
- **THEN** a confirmation explains that the QR and the link stop working
- **AND** confirming sets the status to `revoked` and updates the row without reloading
- **AND** cancelling leaves the pass untouched

#### Scenario: Used, revoked, or expired pass

- **WHEN** the pass is `used`, `revoked`, or `expired`
- **THEN** `Ver QR` and `Regenerar enlace` are disabled
- **AND** `Copiar enlace` remains available only while the link has not expired

### Requirement: History reflects mutations immediately

The history SHALL show the result of a mutation without a manual reload.

#### Scenario: Create from the form

- **WHEN** the resident saves a new authorization
- **THEN** the app navigates to the history
- **THEN** the new row is present without a page reload

#### Scenario: Create from the bulk flow

- **WHEN** the resident completes a bulk upload
- **THEN** the history shows the created passes with the batch label
- **AND** the total count reflects the created rows

#### Scenario: Revoke from another tab

- **WHEN** the resident revokes a pass in one tab
- **THEN** reloading the history in another tab shows the updated status

### Requirement: History API contract

The pass list endpoint SHALL support the history needs without per-row requests.

#### Scenario: Query parameters

- **WHEN** `GET /api/passes` is called with `search`, `status`, `destinationUnitId`, or `batchId`
- **THEN** the API applies them on the server
- **THEN** the response includes the pagination metadata

#### Scenario: Resident scope enforced

- **WHEN** any of those filters is combined with a pass from another resident
- **THEN** that pass is not returned
- **AND** the response is not an error

#### Scenario: Enriched rows

- **WHEN** the list is returned
- **THEN** each row includes `batchId`, `batchLabel`, `destination`, and `locationPath`
- **AND** the client does not need additional requests to render the table
