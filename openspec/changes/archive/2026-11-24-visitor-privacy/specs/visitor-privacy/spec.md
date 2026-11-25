## ADDED Requirements

### Requirement: The visitor authorizes the treatment

The system SHALL record the visitor's authorization before the pass shows a QR,
storing the moment, the IP address, the user agent and the version of the
privacy policy that was accepted. The acceptance SHALL be an unchecked box by
default and SHALL NOT be a condition hidden inside another action.

#### Scenario: The visitor opens the pass for the first time
- **WHEN** the visitor opens the pass link and the pass has no recorded
  authorization
- **THEN** the page shows the notice and an unchecked box
- **AND** the QR is not shown until the box is checked and accepted
- **AND** the acceptance is stored with its date, IP, user agent and policy
  version

#### Scenario: The visitor already accepted
- **WHEN** the visitor opens the link again
- **THEN** the QR is shown without asking again
- **AND** the recorded authorization is not overwritten

#### Scenario: The visitor never opens the link
- **WHEN** a guard verifies a pass whose visitor never opened the link
- **THEN** the access records the authorization as given at the gate
- **AND** the record states that mode instead of pretending the visitor accepted
  a form

### Requirement: The identity is kept for a short, explicit window

The identity of the visitor SHALL be kept for the number of days the
organization configures, limited to 30, 60 or 90, with 30 as the default. After
that window the identity SHALL be anonymized.

#### Scenario: A record inside the window
- **WHEN** an access happened within the configured window
- **THEN** its identity is intact and readable by the roles allowed to see it

#### Scenario: A record outside the window
- **WHEN** an access is older than the configured window
- **THEN** name, document, plate and companions are replaced by anonymous values
- **AND** the access itself — date, gate, result, reason, shift and pass — is
  preserved

#### Scenario: An invalid window is rejected
- **WHEN** an organization tries to set a window other than 30, 60 or 90 days
- **THEN** the request is rejected
- **AND** the configured window is unchanged

### Requirement: Anonymization removes the visitor from the free text too

The anonymization SHALL remove the visitor's name from the summary of the
access record, not only from its structured fields. It SHALL preserve the name
of the resident who authorized the visit.

#### Scenario: The summary no longer names the visitor
- **WHEN** an access is anonymized
- **THEN** its summary no longer contains the visitor's name
- **AND** the details keep the direction, the reason and the pass reference

#### Scenario: The authorizing resident stays identified
- **WHEN** an access is anonymized
- **THEN** the resident who authorized it remains identified
- **AND** the trail of who granted the permission is preserved

### Requirement: An incident can preserve specific records

The system SHALL allow preserving a date range, optionally narrowed to a
community, with a reason, an author and an expiry. The anonymization SHALL skip
every record inside an active preservation.

#### Scenario: A range is preserved
- **WHEN** an administrator preserves a range of dates for an investigation
- **THEN** the accesses inside that range are not anonymized while the
  preservation is active
- **AND** accesses outside the range keep their normal window

#### Scenario: The preservation expires
- **WHEN** a preservation reaches its expiry
- **THEN** it stops protecting records
- **AND** the next sweep anonymizes what fell out of the window

#### Scenario: A preservation is released early
- **WHEN** an administrator releases a preservation
- **THEN** the records it protected become eligible again
- **AND** the release is recorded with its author and moment

### Requirement: Only administrators read the full document

The full document of a visitor SHALL be visible only to the community
administrator, the organization administrator and the platform administrator,
inside the retention window. The operator and the guard SHALL see it masked in
the history. The resident SHALL see the data of the guests they authorized.

#### Scenario: A guard opens the history
- **WHEN** a guard opens an access record of a previous day
- **THEN** the document appears masked
- **AND** the guard never receives the full document outside a scan

#### Scenario: A guard scans a pass
- **WHEN** a guard scans the pass of a visitor who is present
- **THEN** the scan response shows the identity that is needed to verify it

#### Scenario: An administrator opens the record
- **WHEN** a community or organization administrator opens a record inside the
  window
- **THEN** the document is shown complete

#### Scenario: The resident reviews an authorization
- **WHEN** a resident opens a pass they authorized
- **THEN** they see the data of their own guest
- **AND** they never see the guests of another resident

### Requirement: The exports carry no identity

The report exports SHALL contain aggregates and SHALL NOT contain visitor names
or documents.

#### Scenario: An administrator exports a report
- **WHEN** a report is exported to CSV, XLSX or PDF
- **THEN** the file has no visitor identity
- **AND** it keeps the totals, the methods, the access points and the shifts

### Requirement: The treatment is informed and documented

The system SHALL expose the privacy policy and the gate notice as documents of
the project, including the transmission clause for the guard company.

#### Scenario: The visitor wants to read the policy
- **WHEN** the visitor opens the notice
- **THEN** they reach the policy that states the responsible party, the purpose,
  the rights and the retention window

#### Scenario: The guard company processes the data
- **WHEN** a security company provides the guards
- **THEN** a transmission clause states that it processes the data only for
  access control and under the community's instructions
