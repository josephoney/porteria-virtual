## ADDED Requirements

### Requirement: Pass enums

The shared package SHALL define pass-related enums.

#### Scenario: Pass type enum
- **WHEN** a developer uses `PassType.EntryOnly`
- **THEN** the value is the string `'entry_only'`
- **THEN** the enum includes `EntryOnly`, `EntryExit`, and `EntryExitRecurring`

#### Scenario: Pass status enum
- **WHEN** a developer uses `PassStatus.Active`
- **THEN** the value is the string `'active'`
- **THEN** the enum includes `Active`, `Used`, `Revoked`, and `Expired`

#### Scenario: Presence state enum
- **WHEN** a developer uses `PresenceState.Inside`
- **THEN** the value is the string `'inside'`
- **THEN** the enum includes `Outside` and `Inside`

#### Scenario: Scan enums
- **WHEN** a developer inspects `ScanAction` and `ScanStatus`
- **THEN** `ScanAction` includes `Entry` and `Exit`
- **THEN** `ScanStatus` includes `Pending`, `Confirmed`, and `Rejected`

### Requirement: Pass entity types

The shared package SHALL define pass, scan, and alert types.

#### Scenario: AccessPass type
- **WHEN** a developer inspects `AccessPass`
- **THEN** it includes `id`, `communityId`, `unitId`, `createdBy`, `visitorFirstName`,
  `visitorLastName`, `visitorDocument`, `hasVehicle`, `vehiclePlate`, `type`,
  `validFrom`, `validUntil`, `allowedDays`, `timeFrom`, `timeTo`, `status`,
  `presenceState`, `pinEnabled`, `entryAt`, `exitAt`, `entryCount`, `exitCount`

#### Scenario: PassScan type
- **WHEN** a developer inspects `PassScan`
- **THEN** it includes `id`, `passId`, `guardId`, `visitorFirstName`, `visitorLastName`,
  `visitorDocument`, `vehiclePlate`, `action`, `result`, `reason`, `status`,
  `scannedAt`, `confirmedAt`

#### Scenario: PassAlert type
- **WHEN** a developer inspects `PassAlert`
- **THEN** it includes `id`, `passId`, `communityId`, `type`, `status`, `dueAt`,
  `createdAt`, `resolvedAt`

### Requirement: Pass DTOs

The shared package SHALL define the API contracts for passes and scans.

#### Scenario: Create pass DTO
- **WHEN** a developer inspects `CreatePassDto`
- **THEN** it includes `unitId`, `visitorFirstName`, `visitorLastName`,
  `visitorDocument`, `hasVehicle`, `vehiclePlate?`, `type`, `validFrom`, `validUntil`,
  `allowedDays`, `timeFrom`, `timeTo`, `pin?`

#### Scenario: Pass link response
- **WHEN** a developer inspects `PassLinkResponse`
- **THEN** it includes `pass`, `shareUrl`, and `qrToken`
- **THEN** it does not expose the raw link token separately

#### Scenario: Public pass preview
- **WHEN** a developer inspects `PublicPassPreview`
- **THEN** it includes `communityName`, `visitorFirstName`, `maskedDocument`, `unitCode`,
  `validFrom`, `validUntil`, `timeFrom`, `timeTo`, `vehiclePlate`, `status`,
  `presenceState`, `pinRequired`

#### Scenario: Scan response
- **WHEN** a developer inspects `ScanPassResponse`
- **THEN** it includes `scanId`, `authorized`, `action`, `reason`, `visitor`,
  `vehiclePlate`, `unitCode`, `authorizedByName`, `schedule`, and `presenceState`
