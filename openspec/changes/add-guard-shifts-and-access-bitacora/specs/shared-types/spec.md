## ADDED Requirements

### Requirement: Access point types

The shared package SHALL export types for named access points.

#### Scenario: AccessPoint type

- **WHEN** a developer inspects `AccessPoint`
- **THEN** it includes `id`, `communityId`, `name`, `type`, `direction`, `active`,
  `gpioPin`, `createdAt` and `updatedAt`

#### Scenario: Access point direction values

- **WHEN** a developer inspects the direction enum
- **THEN** it contains `entry`, `exit` and `both`

### Requirement: Guard shift types

The shared package SHALL export types and enums for guard shifts.

#### Scenario: GuardShift type

- **WHEN** a developer inspects `GuardShift`
- **THEN** it includes `id`, `communityId`, `guardPersonId`, `guardAccountId`, `status`,
  `startedAt`, `endedAt`, `endedByPersonId`, `closedReason`, `createdAt` and `updatedAt`

#### Scenario: GuardShiftSegment type

- **WHEN** a developer inspects `GuardShiftSegment`
- **THEN** it includes `id`, `shiftId`, `accessPointId`, `startedAt`, `endedAt`,
  `endReason` and `createdAt`

#### Scenario: Shift status values

- **WHEN** a developer inspects the shift status enum
- **THEN** it contains `open` and `closed`

### Requirement: Bitácora types

The shared package SHALL export types and enums for the access bitácora.

#### Scenario: BitacoraEntry type

- **WHEN** a developer inspects `BitacoraEntry`
- **THEN** it includes `id`, `communityId`, `accessPointId`, `accessPointName`,
  `destinationLocationUnitId`, `destinationPath`, `authorizedByPersonId`,
  `authorizedByName`, `shiftId`, `type`, `source`, `authorPersonId`,
  `authorAccountId`, `passId`, `passScanId`, `summary`, `details` and `createdAt`

#### Scenario: BitacoraComment type

- **WHEN** a developer inspects `BitacoraComment`
- **THEN** it includes `id`, `entryId`, `authorPersonId`, `authorAccountId`, `body` and
  `createdAt`

#### Scenario: Entry type values

- **WHEN** a developer inspects the bitácora entry type enum
- **THEN** it contains `pass_entry`, `pass_exit`, `pass_rejected`, `scan_denied`,
  `shift_start`, `shift_end` and `manual`

#### Scenario: Source values

- **WHEN** a developer inspects the bitácora source enum
- **THEN** it contains `app`, `dashboard` and `system`

### Requirement: Guard and bitácora DTOs

The shared package SHALL export request and response DTOs for the new flows.

#### Scenario: Shift DTOs

- **WHEN** a developer inspects the shift DTOs
- **THEN** `StartShiftDto`, `ChangeAccessPointDto`, `GuardShiftCurrentResponse` and the
  shift history item are available

#### Scenario: Bitácora DTOs

- **WHEN** a developer inspects the bitácora DTOs
- **THEN** `BitacoraEntryDto`, `BitacoraEntryDetailDto`, `CreateBitacoraEntryDto`,
  `CreateBitacoraCommentDto` and the paginated list response are available

#### Scenario: Scan response additions

- **WHEN** a developer inspects `ScanPassResponse` and `ScanDecisionResponse`
- **THEN** they include `accessPointId`, `accessPointName`, `shiftId` and
  `bitacoraEntryId` as applicable
