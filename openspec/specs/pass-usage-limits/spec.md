# pass-usage-limits Specification

## Purpose
TBD - created by archiving change pass-usage-limits. Update Purpose after archive.
## Requirements
### Requirement: A pass declares how many uses it allows

Every pass SHALL declare how many entry and exit pairs it authorizes, defaulting to one.

#### Scenario: Creating a pass with two uses

- WHEN the resident creates a pass of entry and exit with two uses
- THEN the pass allows two entries and two exits inside its window
- AND the third exit is refused because the pass is consumed

#### Scenario: Default is one use

- WHEN the resident creates a pass without choosing a number of uses
- THEN the pass authorizes one entry and one exit

#### Scenario: An entry-only pass ignores the count

- WHEN a pass of entry only is created with two uses
- THEN the stored value is one
- AND the pass is consumed with the first entry

### Requirement: One use is one entry and one exit

The system SHALL count a use as a completed pair, measured when the visitor leaves.

#### Scenario: Entering does not consume a use

- WHEN a visitor enters with a pass of two uses
- THEN one use remains available
- AND the pass still allows the exit

#### Scenario: Leaving consumes the use

- WHEN the visitor leaves
- THEN the pass records one use consumed
- AND it stays valid for another entry while uses remain and the window lasts

### Requirement: The status is derived from the counters

The pass status SHALL be computed from the recorded movements and the declared uses, the same way for every entry path.

#### Scenario: The QR and the document agree

- WHEN the same pass is used once by QR and once by document
- THEN both paths apply the same usage rule
- AND the pass is not consumed after the first exit when it declares more uses

#### Scenario: Expiry by time still applies

- WHEN the pass window ends
- THEN the pass stops accepting entries even if uses remain

### Requirement: Bulk authorizations carry the use count

The bulk upload SHALL accept a number of uses and apply it to every pass in the batch.

#### Scenario: Batch with two uses

- WHEN the resident uploads a batch with two uses
- THEN every created pass allows two entry and exit pairs
- AND omitting the value leaves every pass with one use

### Requirement: A visitor who never left is flagged

The system SHALL create a missing exit alert when a visitor stays inside past the pass window plus the configured grace period.

#### Scenario: The alert is created once

- WHEN a pass is still inside after its window plus the grace period
- THEN one missing exit alert is created
- AND running the check again does not create a second one

#### Scenario: Leaving resolves the alert

- WHEN the visitor leaves after the alert was created
- THEN the alert is marked as resolved
- AND the pass shows the movements of the day

#### Scenario: The alert is visible without notifications

- WHEN a missing exit alert is open
- THEN the record shows a badge identifying it
- AND no push notification is sent

