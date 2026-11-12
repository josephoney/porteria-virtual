## ADDED Requirements

### Requirement: Bulk authorization entry point

The resident SHALL create many authorizations in one operation from a CSV file.

#### Scenario: Access from the resident workspace

- **WHEN** the resident opens `Autorización masiva` from the home or the history
- **THEN** the page shows a CSV file input and a paste area
- **AND** it shows a downloadable template with the expected headers

#### Scenario: Shared trip data

- **WHEN** the bulk form is filled
- **THEN** a single destination is required for the whole batch
- **THEN** a single pass type, `validFrom`, and `validUntil` are required
- **THEN** a single optional batch label of up to 80 characters is accepted

#### Scenario: No destination selected

- **WHEN** the resident tries to preview without a destination
- **THEN** the form blocks the action with a field-level message
- **AND** no request is sent

### Requirement: CSV format

The batch input SHALL accept a documented CSV shape.

#### Scenario: Required headers

- **WHEN** the file is parsed
- **THEN** the headers `nombre`, `apellido`, and `documento` are required
- **THEN** `placa` is optional
- **THEN** header matching ignores case and surrounding spaces

#### Scenario: Valid row

- **WHEN** a row has a non-empty name, last name, and document
- **THEN** it is marked valid in the preview
- **AND** the vehicle flag is set when `placa` is present

#### Scenario: Invalid row

- **WHEN** a row is missing the name, last name, or document
- **THEN** it is marked invalid with the reason for that row
- **AND** the invalid row does not block the valid rows

#### Scenario: Unknown headers

- **WHEN** a required header is missing
- **THEN** the file is rejected as a whole before any insert
- **AND** the message lists the missing headers

#### Scenario: Empty file

- **WHEN** the file has headers but no rows
- **THEN** the preview shows an empty state
- **AND** the create action stays disabled

### Requirement: Batch limits

The system SHALL bound the size of a batch and reject rows that cannot be authorized.

#### Scenario: Row limit

- **WHEN** the file has more than 200 data rows
- **THEN** the file is rejected with the row count and the limit
- **AND** no pass is created

#### Scenario: Duplicate document inside the file

- **WHEN** two rows share the same document
- **THEN** the first row is kept as valid
- **THEN** the duplicate is marked invalid with reason `documento duplicado en el archivo`
- **AND** the resident can fix the file and preview again

#### Scenario: Existing active pass

- **WHEN** a row's document already has an active pass for the same destination and overlapping validity
- **THEN** the row is marked invalid with reason `ya tiene una autorización activa para ese destino`

### Requirement: Preview before creating

The resident SHALL review the parsed batch before it is persisted.

#### Scenario: Preview content

- **WHEN** a valid file is previewed
- **THEN** a table shows one row per CSV line with name, last name, document, plate, and validity result
- **THEN** a summary shows the number of valid and invalid rows
- **AND** the create action states how many passes will be created

#### Scenario: Invalid rows present

- **WHEN** the preview contains invalid rows
- **THEN** the create action still creates only the valid rows
- **AND** the label makes clear that invalid rows are skipped

#### Scenario: Edit after preview

- **WHEN** the resident changes the destination or the validity window after previewing
- **THEN** the preview is invalidated
- **AND** it must be generated again before creating

#### Scenario: Cancel

- **WHEN** the resident leaves the bulk page before confirming
- **THEN** no pass is created
- **AND** the history is unchanged

### Requirement: Batch creation result

The system SHALL report what was created and what was rejected for every batch.

#### Scenario: Successful batch

- **WHEN** the resident confirms a preview with valid rows
- **THEN** the API creates one pass per valid row in a single transaction
- **THEN** every created pass carries the same `batch_id` and the optional `batch_label`
- **THEN** the response returns the created count and the rejected rows with reasons

#### Scenario: Partial success

- **WHEN** some rows are rejected during creation
- **THEN** the valid rows are still created
- **THEN** the result screen shows created and rejected counts
- **AND** the rejected rows are listed with their reason so they can be fixed and re-uploaded

#### Scenario: Database failure

- **WHEN** the insert fails before completing
- **THEN** the transaction rolls back
- **THEN** no pass from that batch is persisted
- **AND** the resident sees a retry action

#### Scenario: Result actions

- **WHEN** the batch finishes
- **THEN** the resident can open the history filtered by that batch
- **AND** can start another batch without reloading the page

### Requirement: Batch API contract

The API SHALL expose a single endpoint that creates a batch under the same scope rules as a single pass.

#### Scenario: Endpoint

- **WHEN** the resident posts a batch to `/api/passes/batch`
- **THEN** the body contains `destination`, `type`, `validFrom`, `validUntil`, `batchLabel`, and `visitors[]`
- **THEN** the endpoint requires an active `owner`, `tenant`, or `resident` membership
- **AND** it returns `201` with the created passes and the rejected rows

#### Scenario: Scope validation

- **WHEN** the destination is not allowed for the resident
- **THEN** the response has status 403 or 404 according to the existing pass rules
- **AND** no pass is created

#### Scenario: Server-side limits

- **WHEN** the request contains more than 200 visitors
- **THEN** the response has status 400 with reason `batch_too_large`
- **AND** the message includes the maximum
