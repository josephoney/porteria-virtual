# live-resident-passes Specification

## Purpose
TBD - created by archiving change live-resident-passes. Update Purpose after archive.
## Requirements
### Requirement: Pass changes are announced to their owner

The server SHALL publish an event every time the status of a pass changes, addressed to the person who created that pass.

#### Scenario: A scanned pass notifies its owner

- WHEN a guard confirms a scan for a pass
- THEN the server publishes an event with the pass id and its new status
- AND the event is addressed to the person who created the pass

#### Scenario: A revoked pass notifies its owner

- WHEN a resident revokes one of their passes
- THEN the server publishes an event addressed to that same resident

#### Scenario: A rejected scan notifies its owner

- WHEN a guard rejects a scan
- THEN the owner receives an event even though the pass keeps its status

### Requirement: Only the owner receives the event

The stream SHALL deliver events of the authenticated person and nobody else.

#### Scenario: Another resident's pass stays invisible

- WHEN two residents have the stream open
- AND a pass of the first one is scanned
- THEN only the first resident receives the event
- AND the second one receives nothing

#### Scenario: The identity comes from the token

- WHEN a resident opens the stream
- THEN the server resolves the person from the session
- AND ignores any identity sent as a query parameter

### Requirement: The history refreshes without a reload

The authorization history SHALL reflect a status change without the user reloading the page.

#### Scenario: A used pass changes its badge

- WHEN the resident has the history open
- AND a guard confirms the scan of one of their passes
- THEN the row shows "Usada" without a manual refresh
- AND the filters and the current page stay where they were

#### Scenario: A revocation from another session is reflected

- WHEN the resident revokes a pass from another tab or device
- THEN the open history marks it "Revocada"

#### Scenario: The stream fails and the fallback covers it

- WHEN the stream disconnects
- THEN the history keeps refreshing through a 30 second poll
- AND reconnecting reloads the table so no event is lost

### Requirement: The home list also stays current

The passes shown on the resident home SHALL update when their status changes.

#### Scenario: A pass used while the home is open

- WHEN the resident is on the home screen
- AND a pass of theirs is used at the gate
- THEN the "Vigentes ahora" list drops that pass without a reload

