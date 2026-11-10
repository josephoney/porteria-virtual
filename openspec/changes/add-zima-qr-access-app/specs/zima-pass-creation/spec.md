## ADDED Requirements

### Requirement: Pass creation form

The resident SHALL create a pass from the app.

#### Scenario: Required fields

- **WHEN** the resident opens the create-pass screen
- **THEN** the form asks for first name, last name, document, type, and valid dates
- **THEN** the daily time window is optional in the MVP

#### Scenario: Unit selection

- **WHEN** the resident has one or more units
- **THEN** the app shows a unit selector from their active memberships
- **THEN** the selector displays `locationPath` and submits `locationUnitId`

#### Scenario: Create success

- **WHEN** the form is valid and the API returns 201
- **THEN** the app navigates to the pass detail with the share link and QR

#### Scenario: Validation error

- **WHEN** the API returns 400 or 403
- **THEN** the app shows the error and keeps the form values

### Requirement: Pass types

The form SHALL support the two MVP pass types.

#### Scenario: Entry only

- **WHEN** the resident selects “Solo ingreso”
- **THEN** the app submits `entry_only`

#### Scenario: Entry and exit

- **WHEN** the resident selects “Ingreso y salida”
- **THEN** the app submits `entry_exit`

#### Scenario: Recurring reserved

- **WHEN** the MVP runs
- **THEN** the app does not offer “Ingreso y salida recurrente”
- **THEN** the recurring option is added in Phase 2

### Requirement: Vehicle

The form SHALL capture an optional vehicle.

#### Scenario: Vehicle enabled

- **WHEN** the resident toggles “Tiene vehículo”
- **THEN** the app asks for the plate and requires it before submitting

#### Scenario: No vehicle

- **WHEN** the toggle is off
- **THEN** the app submits `hasVehicle = false` without a plate

### Requirement: Optional PIN

The form SHALL allow a 4-digit PIN.

#### Scenario: PIN enabled

- **WHEN** the resident enters exactly 4 digits
- **THEN** the app submits it and the API stores only the hash

#### Scenario: Invalid PIN

- **WHEN** the PIN is not exactly 4 digits
- **THEN** the app blocks submission with a local error

### Requirement: Schedule defaults

The form SHALL provide sensible defaults.

#### Scenario: Default window

- **WHEN** the resident opens the form
- **THEN** the daily window is optional and the valid range starts today

#### Scenario: Invalid schedule

- **WHEN** the end is before the start
- **THEN** the app blocks submission with a local error
