## ADDED Requirements

### Requirement: Camera permission

The guard mode SHALL request camera permission before scanning.

#### Scenario: Permission granted
- **WHEN** the guard opens the scanner for the first time
- **THEN** the app requests camera permission and opens the camera

#### Scenario: Permission denied
- **WHEN** the guard denies camera permission
- **THEN** the app shows an explanation and offers a manual token input for testing

### Requirement: Scan QR

The guard SHALL scan the visitor's QR.

#### Scenario: Successful scan
- **WHEN** the camera reads a valid QR
- **THEN** the app calls `/api/access/scan`
- **THEN** it shows the visitor data and the action (`entry` or `exit`)

#### Scenario: Invalid token
- **WHEN** the API returns an invalid or expired token error
- **THEN** the app shows a clear error and keeps the scanner open

### Requirement: Scan result

The app SHALL show the authorization details.

#### Scenario: Authorized
- **WHEN** the scan is authorized
- **THEN** the app shows first name, last name, document, plate if any, unit, and the
  resident who authorized the pass

#### Scenario: Denied
- **WHEN** the scan is denied
- **THEN** the app shows the reason and does not offer Confirm

### Requirement: Confirm and reject

The guard SHALL confirm or reject the access.

#### Scenario: Confirm
- **WHEN** the guard confirms
- **THEN** the app calls the confirm endpoint
- **THEN** it shows the registered entry/exit time

#### Scenario: Reject
- **WHEN** the guard rejects
- **THEN** the app calls the reject endpoint
- **THEN** it shows the rejection recorded

#### Scenario: Already processed
- **WHEN** the API returns 409 because the scan was already processed
- **THEN** the app shows the final state and resets to the scanner

### Requirement: Guard history

The guard SHALL see their recent scans.

#### Scenario: History list
- **WHEN** the guard opens the history
- **THEN** the app lists recent scans with visitor, action, result, and time

#### Scenario: Empty history
- **WHEN** there are no scans
- **THEN** the app shows an empty state
