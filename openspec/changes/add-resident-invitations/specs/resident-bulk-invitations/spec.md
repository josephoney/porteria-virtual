## ADDED Requirements

### Requirement: Bulk invitation file

The dashboard SHALL accept a CSV file to invite many residents at once.

#### Scenario: Expected columns
- **WHEN** the user downloads the template
- **THEN** the file has the header `unidad,correo,nombre`
- **THEN** `unidad` and `correo` are required per row
- **THEN** `nombre` is optional

#### Scenario: Unit identification
- **WHEN** a row is parsed
- **THEN** `unidad` is resolved by unit code within the selected community
- **THEN** the full location path is also accepted as a fallback
- **THEN** an unknown or ambiguous unit marks the row as invalid

#### Scenario: Encoding and separators
- **WHEN** the file is read
- **THEN** UTF-8 with or without BOM is accepted
- **THEN** comma and semicolon separators are both accepted
- **THEN** quoted fields with commas inside are supported

#### Scenario: Size limit
- **WHEN** the file has more than 500 data rows
- **THEN** the upload is rejected before sending anything
- **THEN** the message states the limit

### Requirement: Preview before sending

The user SHALL review the parsed rows before creating invitations.

#### Scenario: Preview summary
- **WHEN** the file is parsed
- **THEN** the page shows total, valid and invalid rows
- **THEN** the first rows are listed with their resolved unit and email

#### Scenario: Row validation
- **WHEN** an email is malformed, repeated in the file, or already a member of that unit
- **THEN** the row is marked invalid with the reason
- **THEN** duplicate rows are grouped so only one invitation is created

#### Scenario: Nothing valid
- **WHEN** every row is invalid
- **THEN** the send action is disabled

### Requirement: Bulk submission and per-row results

The API SHALL process a bulk invitation and report each row independently.

#### Scenario: Partial success
- **WHEN** the bulk request contains valid and invalid rows
- **THEN** valid rows create invitations
- **THEN** invalid or conflicting rows are reported with their index and reason
- **THEN** one failing row does not abort the rest

#### Scenario: Result summary
- **WHEN** the bulk request finishes
- **THEN** the response contains counts of created, skipped and failed rows
- **THEN** the dashboard shows the counts and the failed rows with reasons

#### Scenario: Scope enforcement
- **WHEN** a row targets a unit outside the actor's scope
- **THEN** that row fails with 403-equivalent status
- **THEN** the rest of the file is still processed

#### Scenario: Idempotency
- **WHEN** the same file is submitted twice
- **THEN** invitations already pending for the same email and unit are skipped
- **THEN** no duplicate pending invitation is created

### Requirement: Bulk entry point

The dashboard SHALL expose the bulk load where units live.

#### Scenario: Open bulk load
- **WHEN** an authorized user chooses "Carga masiva" in the units workspace
- **THEN** the page asks for the community and the CSV file
- **THEN** the flow continues to preview and results

#### Scenario: Authorization
- **WHEN** the user is not `org_admin`, `community_admin` or platform admin
- **THEN** the bulk action is not shown
