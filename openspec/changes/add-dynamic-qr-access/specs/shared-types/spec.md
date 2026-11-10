## ADDED Requirements

### Requirement: Pass enums

The shared package SHALL define pass-related enums.

#### Scenario: Pass type enum

- **WHEN** a developer uses `PassType.EntryOnly`
- **THEN** the value is the string `'entry_only'`
- **THEN** the enum includes `EntryOnly`, `EntryExit`, and `EntryExitRecurring`
- **THEN** `EntryExitRecurring` is reserved for Phase 2

#### Scenario: Pass status enum

- **WHEN** a developer uses `PassStatus.Active`
- **THEN** the value is the string `'active'`
- **THEN** the enum includes `Active`, `Used`, `Revoked`, and `Expired`

#### Scenario: Presence state enum

- **WHEN** a developer uses `PresenceState.Inside`
- **THEN** the value is the string `'inside'`
- **THEN** the enum includes `Outside` and `Inside`

#### Scenario: Scan enums

- **WHEN** a developer inspects `ScanAction`, `ScanStatus`, and `ScanResult`
- **THEN** `ScanAction` includes `Entry` and `Exit`
- **THEN** `ScanStatus` includes `Pending`, `Confirmed`, `Rejected`, and `Expired`
- **THEN** `ScanResult` includes `Authorized` and `Denied`

#### Scenario: Alert enums

- **WHEN** a developer inspects `PassAlertType` and `PassAlertStatus`
- **THEN** `PassAlertType` includes `MissingExit`
- **THEN** `PassAlertStatus` includes `Open` and `Resolved`

### Requirement: Pass entity types

The shared package SHALL define pass, scan, and alert types.

#### Scenario: AccessPass type

- **WHEN** a developer inspects `AccessPass`
- **THEN** it includes `id`, `communityId`, `locationUnitId`, `structureId`,
  `createdByPersonId`, `authorizedByPersonId`, `authorizedByDelegationId`,
  `visitorFirstName`, `visitorLastName`, `visitorDocument`, `hasVehicle`,
  `vehiclePlate`, `type`, `validFrom`, `validUntil`, `allowedDays`, `timeFrom`,
  `timeTo`, `status`, `presenceState`, `linkExpiresAt`, `pinEnabled`, `boundAt`,
  `entryAt`, `exitAt`, `entryCount`, `exitCount`, `createdAt`, `updatedAt`
- **THEN** it does not expose `linkTokenHash`, `deviceKeyHash`, or `pinHash`

#### Scenario: PassScan type

- **WHEN** a developer inspects `PassScan`
- **THEN** it includes `id`, `passId`, `guardPersonId`, `guardAccountId`, `communityId`,
  `locationUnitId`, `structureId`, `visitorFirstName`, `visitorLastName`,
  `visitorDocument`, `vehiclePlate`, `action`, `result`, `reason`, `status`,
  `scannedAt`, `confirmedAt`

#### Scenario: PassAlert type

- **WHEN** a developer inspects `PassAlert`
- **THEN** it includes `id`, `passId`, `communityId`, `type`, `status`, `dueAt`,
  `createdAt`, `resolvedAt`, `resolvedByPersonId`

### Requirement: Pass DTOs

The shared package SHALL define the API contracts for passes and scans.

#### Scenario: Create pass DTO

- **WHEN** a developer inspects `CreatePassDto`
- **THEN** it includes `locationUnitId`, `visitorFirstName`, `visitorLastName`,
  `visitorDocument`, `hasVehicle`, `vehiclePlate?`, `type`, `validFrom`, `validUntil`,
  `allowedDays?`, `timeFrom?`, `timeTo?`, `pin?`
- **THEN** it does not include `unitId` or `communityId`
- **THEN** the server derives `communityId` and `structureId` from `locationUnitId`

#### Scenario: Pass link response

- **WHEN** a developer inspects `PassLinkResponse`
- **THEN** it includes `pass`, `shareUrl`, and `qrToken`
- **THEN** it does not expose the raw link token separately

#### Scenario: Public pass preview

- **WHEN** a developer inspects `PublicPassPreview`
- **THEN** it includes `communityName`, `visitorFirstName`, `maskedDocument`,
  `locationPath`, `validFrom`, `validUntil`, `timeFrom`, `timeTo`, `vehiclePlate`,
  `status`, `presenceState`, `pinRequired`
- **THEN** `locationPath` includes the structure, level, and unit labels

#### Scenario: Pass status response

- **WHEN** a developer inspects `PassStatusResponse`
- **THEN** it includes `status`, `presenceState`, and an optional `nextWindow`

#### Scenario: Scan response

- **WHEN** a developer inspects `ScanPassResponse`
- **THEN** it includes `scanId`, `authorized`, `action`, `reason`, `visitor`,
  `vehiclePlate`, `locationPath`, `authorizedByName`, `authorizedByPersonId`,
  `schedule`, `presenceState`
