## ADDED Requirements

### Requirement: A pass can include companions

A pass SHALL allow zero or more companions. Each companion MUST have a first name, a last name and a document.

#### Scenario: Create with companions

- **WHEN** a resident creates a pass with two companions
- **THEN** the API stores both companions and returns them in the pass detail

#### Scenario: Create without companions

- **WHEN** a resident creates a pass without companions
- **THEN** the pass detail returns an empty companion list

### Requirement: Companion validation

The API SHALL reject a companion with a missing first name, last name or document. It SHALL reject more than 10 companions on one pass and duplicate documents within the same pass.

#### Scenario: Incomplete companion

- **WHEN** a resident submits a companion without a document
- **THEN** the API rejects the pass with a validation error

#### Scenario: Too many companions

- **WHEN** a resident submits more than 10 companions
- **THEN** the API rejects the pass with a validation error

#### Scenario: Duplicate companion document

- **WHEN** a resident submits two companions with the same document
- **THEN** the API rejects the pass with a validation error

### Requirement: Companions are informational

Companions SHALL NOT create separate passes, QR codes or uses. The primary pass SHALL remain the only scannable credential.

#### Scenario: One QR for the group

- **WHEN** a pass has two companions
- **THEN** the resident shares one QR for the primary pass and no companion QR is generated

#### Scenario: Uses stay per pass

- **WHEN** the group enters and exits
- **THEN** the use counter changes once for the pass, not once per companion

### Requirement: Resident surfaces accept companions

The dashboard create form, the mobile resident create form and the bulk upload SHALL let the resident add companions with first name, last name and document.

#### Scenario: Dashboard form

- **WHEN** the resident adds a companion in the dashboard form
- **THEN** the review and the created pass include that companion

#### Scenario: Mobile form

- **WHEN** the resident adds a companion in the mobile form
- **THEN** the created pass includes that companion

#### Scenario: Bulk upload

- **WHEN** a bulk CSV row includes companions in the documented `companions` column
- **THEN** the created pass includes those companions and a malformed value is reported for that row

### Requirement: Guard sees companions

The identity candidate, the QR scan result and the pass/bitacora detail SHALL show the companions with their names and documents.

#### Scenario: QR scan result

- **WHEN** the guard scans a pass QR that has companions
- **THEN** the scan result lists each companion with name and document before the guard confirms or rejects

#### Scenario: Identity candidate

- **WHEN** the guard searches by the primary visitor's document
- **THEN** the candidate lists each companion with name and document

#### Scenario: Pass detail

- **WHEN** the guard or resident opens the pass detail
- **THEN** the detail shows the companions and their documents

### Requirement: Public page protects companion data

The public QR page SHALL NOT expose companion documents. It SHALL show only the number of companions.

#### Scenario: Public page with companions

- **WHEN** a visitor opens the public QR page for a pass with two companions
- **THEN** the page shows that there are two companions and does not show their documents

#### Scenario: Public page without companions

- **WHEN** a visitor opens the public QR page for a pass without companions
- **THEN** the page does not show a companion section or shows a zero count
