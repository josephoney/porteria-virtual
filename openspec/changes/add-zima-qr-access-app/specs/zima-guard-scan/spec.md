## ADDED Requirements

### Requirement: Guard shift gate

The guard mode SHALL require an open shift before scanning.

#### Scenario: No open shift

- **WHEN** the guard opens the app without a shift
- **THEN** the app shows the access point selector and the start action
- **THEN** the scanner is not available until the shift starts

#### Scenario: Start shift

- **WHEN** the guard selects an active access point and starts the shift
- **THEN** the app calls `POST /api/guard/shifts/start`
- **THEN** the scanner becomes available

#### Scenario: Current shift

- **WHEN** the guard already has an open shift
- **THEN** the app shows the current access point, start time and elapsed time

#### Scenario: Change access point

- **WHEN** the guard is reassigned mid-shift
- **THEN** the app calls `POST /api/guard/shifts/:id/change-access-point`
- **THEN** the scanner uses the new access point

#### Scenario: End shift

- **WHEN** the guard ends the shift
- **THEN** the app calls `POST /api/guard/shifts/:id/end`
- **THEN** the app returns to the start-shift state

#### Scenario: Operator

- **WHEN** the active role is `operator`
- **THEN** the app shows the no-mode notice
- **THEN** the app does not show the scanner

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
- **THEN** it shows the visitor data, the action (`entry` or `exit`), the access point
  name and the location path

#### Scenario: Invalid token

- **WHEN** the API returns an invalid or expired token error
- **THEN** the app shows a clear error and keeps the scanner open

#### Scenario: No active shift

- **WHEN** the API returns 409 `no_active_shift`
- **THEN** the app shows the shift gate again

### Requirement: Scan result

The app SHALL show the authorization details.

#### Scenario: Authorized

- **WHEN** the scan is authorized
- **THEN** the app shows first name, last name, document, plate if any, `locationPath`,
  the access point name, and the resident who authorized the pass

#### Scenario: Denied

- **WHEN** the scan is denied
- **THEN** the app shows the reason and does not offer Confirm

### Requirement: Confirm and reject

The guard SHALL confirm or reject the access.

#### Scenario: Confirm

- **WHEN** the guard confirms
- **THEN** the app calls the confirm endpoint
- **THEN** it shows the registered entry/exit time and the updated bitácora

#### Scenario: Reject

- **WHEN** the guard rejects
- **THEN** the app calls the reject endpoint
- **THEN** it shows the rejection recorded

#### Scenario: Already processed

- **WHEN** the API returns 409 because the scan was already processed
- **THEN** the app shows the final state and resets to the scanner

#### Scenario: Not on shift at access point

- **WHEN** the API returns 403 `not_on_shift_at_access_point`
- **THEN** the app explains that the guard must be on shift at that access point

### Requirement: Guard history

The guard SHALL see their recent shifts and scans.

#### Scenario: History list

- **WHEN** the guard opens the history
- **THEN** the app lists recent shifts with access point, start time, duration and status

#### Scenario: Empty history

- **WHEN** there are no shifts
- **THEN** the app shows an empty state
