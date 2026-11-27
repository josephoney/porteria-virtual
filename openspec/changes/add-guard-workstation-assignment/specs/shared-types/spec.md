## ADDED Requirements

### Requirement: Workstation assignment types

The shared package SHALL export the types and DTOs used by the workstation resource, so the
API and the dashboard describe the same shape.

#### Scenario: Assignment DTO
- **WHEN** a developer imports the workstation assignment DTO
- **THEN** it contains `accessPointId` (nullable), `name`, `type`, `direction`, `active` and
  `communityId`

#### Scenario: Assignment result
- **WHEN** an assignment is saved while the guard has an open shift
- **THEN** the result type includes `appliesNextShift` and `activeShiftAccessPointId`
- **THEN** both fields are optional for the case without an open shift

#### Scenario: Assigned guard list item
- **WHEN** the dashboard renders the guards of an access point
- **THEN** the type includes `membershipId`, `personName`, `onShift` and `shiftId`
- **THEN** `shiftId` is null when the guard has no open shift
