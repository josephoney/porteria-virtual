## ADDED Requirements

### Requirement: Each organization defines its retention window

The platform SHALL keep a retention window per organization, measured in
months, defaulting to twelve. Only the organization's administration and the
platform administration SHALL be able to change it.

#### Scenario: A new organization keeps the default
- **WHEN** an organization is created
- **THEN** its retention window is twelve months
- **AND** no data is anonymized before that window passes

#### Scenario: The organization changes its window
- **WHEN** the organization administration sets a different number of months
- **THEN** the next run uses the new window
- **AND** a window already elapsed applies to the next run, not retroactively to
  an earlier one

#### Scenario: An invalid window is rejected
- **WHEN** a window below one month or above sixty is requested
- **THEN** the request is rejected and the stored window is unchanged

### Requirement: Visitor identity is anonymized, not deleted

Once the window has passed, the visitor identity SHALL be removed from the
access record while the event stays. Anonymization SHALL cover the pass
snapshot, the scan snapshot and the details of the access log entry: visitor
name, document, vehicle plate, companions and the cached authorizer name.

The event SHALL keep its type, result, reason, timestamps, gate, community,
unit, pass reference and shift.

#### Scenario: An old pass loses the visitor identity
- **WHEN** a pass is older than the window
- **THEN** its visitor name, document, plate and companions are replaced by an
  anonymized marker
- **AND** the pass row still exists with its dates, state and community

#### Scenario: An old scan loses the visitor identity
- **WHEN** a scan is older than the window
- **THEN** its visitor name, document and plate are replaced by an anonymized
  marker
- **AND** its action, result, reason, gate and shift are unchanged

#### Scenario: An old log entry loses the visitor identity
- **WHEN** an access log entry is older than the window
- **THEN** its visitor, companions, plate and authorizer name are removed from
  the details payload
- **AND** the entry keeps its type, source, result and timestamps

#### Scenario: The resident directory is untouched
- **WHEN** a retention run executes
- **THEN** the community's people, accounts and their contact data are not
  modified
- **AND** the run does not depend on the window to keep them

### Requirement: Reports do not change when data is anonymized

Anonymizing SHALL NOT alter the totals a report produces, because the report
reads the event and not the identity.

#### Scenario: An anonymized period reports the same totals
- **WHEN** a period is reported before and after a retention run
- **THEN** the totals by result, method, gate and hour are identical
- **AND** only the identity fields differ

### Requirement: Anonymization runs in dry run by default

The retention sweep SHALL be computed and reported without writing unless the
environment explicitly enables writing.

#### Scenario: Dry run by default
- **WHEN** the environment does not enable the retention writer
- **THEN** the sweep reports what it would anonymize
- **AND** no row is modified

#### Scenario: Enabling the writer
- **WHEN** the environment enables the retention writer
- **THEN** the sweep anonymizes the rows that are past the window

#### Scenario: A second run changes nothing
- **WHEN** the sweep runs twice on the same window
- **THEN** the second run finds nothing left to anonymize
- **AND** the record of that run reports zero rows

### Requirement: Every run leaves an audit record

Each sweep SHALL persist, per organization: when it ran, the window it applied,
how many passes, scans and entries it anonymized, and whether it was a dry run.
The organization administration SHALL be able to read its own history.

#### Scenario: A run is recorded
- **WHEN** a sweep finishes
- **THEN** a record exists with the organization, the date, the window, the
  counts and the dry-run flag

#### Scenario: The history is scoped
- **WHEN** an organization's administration reads the run history
- **THEN** it only receives its own runs
- **AND** another organization's runs are never returned
