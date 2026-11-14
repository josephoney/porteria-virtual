# guard-id-verification Specification

## Purpose
TBD - created by archiving change guard-id-verification. Update Purpose after archive.
## Requirements
### Requirement: The guard can verify an authorization by document

The guard SHALL be able to find the authorizations of a visitor by the document registered on the pass, when no QR is available.

#### Scenario: The order of the options

- WHEN the guard opens the scan screen
- THEN the primary action is scanning the QR of the pass
- AND scanning the identity card is offered next to it
- AND typing the document is offered last, behind a secondary control

#### Scenario: A valid document lists its authorizations

- WHEN the guard enters the document of a visitor with an active authorization
- THEN the app lists that authorization with the visitor name, the destination and the validity window
- AND the guard can confirm the entry from that list

#### Scenario: Expired authorizations are not offered

- WHEN the document belongs to a visitor whose authorization already expired or was revoked
- THEN the authorization does not appear in the list
- AND the guard sees a message that there is nothing to authorize

#### Scenario: Another community's authorization stays out

- WHEN the document belongs to a visitor authorized in a different community
- THEN the guard's search returns nothing

### Requirement: The document never authorizes on its own

The system SHALL require an explicit confirmation from the guard before registering an entry.

#### Scenario: The search does not open the gate

- WHEN the guard searches a document
- THEN no entry is registered
- AND nothing changes in the pass until the guard confirms one of the listed authorizations

#### Scenario: A consumed pass is not offered

- WHEN the document belongs to a pass that was already consumed
- THEN the search returns nothing
- AND the app answers exactly as it does for a document with no authorization

### Requirement: Identity entries are audited apart

The system SHALL record entries verified by document with their own origin, so they can be told apart from QR entries.

#### Scenario: The bitacora marks the origin

- WHEN the guard confirms an entry by document
- THEN the bitacora records the entry with the visitor, the guard, the shift and the destination
- AND the origin reads as a manual identity check instead of a QR scan

### Requirement: The document can be scanned from the ID card

The app SHALL be able to read the barcode on the identity card to fill the document field.

#### Scenario: Scanning the card fills the field

- WHEN the guard chooses to scan the identity card
- THEN the camera reads the PDF417 code and fills the document field
- AND the guard still has to press the verification button

#### Scenario: The camera closes after reading

- WHEN the code is read or the guard cancels
- THEN the camera stops
- AND the screen goes back to the previous state

#### Scenario: The two scan modes stay apart

- WHEN the guard chooses to scan a QR
- THEN the camera only looks for QR codes
- AND a barcode on a card is not interpreted as a pass token

### Requirement: The search is bounded

The system SHALL limit how many document searches a guard can run.

#### Scenario: Too many searches

- WHEN a guard exceeds the allowed searches per minute
- THEN the API answers with a rate limit error
- AND the app explains that the guard must wait

#### Scenario: No open shift

- WHEN a guard without an open shift searches a document
- THEN the search is refused
- AND the app points the guard to start the shift first

### Requirement: The guard decides between entry and exit

The system SHALL let the guard record either an entry or an exit for a document, and SHALL refuse the impossible combinations.

#### Scenario: Someone already inside cannot enter again

- WHEN the listed authorization shows the visitor is inside
- THEN the app offers only the exit action
- AND the API refuses an entry for that person

#### Scenario: Someone outside cannot exit

- WHEN the listed authorization shows the visitor is outside
- THEN the app offers only the entry action
- AND the API refuses an exit for that person

#### Scenario: The exit is audited apart

- WHEN the guard records an exit by document
- THEN the bitacora records a pass exit with its own summary
- AND a pass that allows entry and exit stays valid for another entry while its window lasts

