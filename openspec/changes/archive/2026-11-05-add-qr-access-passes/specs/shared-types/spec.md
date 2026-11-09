## ADDED Requirements

### Requirement: Pass enums

The shared package SHALL define pass types and statuses.

#### Scenario: Pass type enum
- **WHEN** a developer uses `PassType.Visitor`
- **THEN** the value is the string `'visitor'`
- **THEN** the enum includes `Visitor`, `Delivery`, `Provider`, `Frequent`, and
  `Temporary`

#### Scenario: Pass status enum
- **WHEN** a developer uses `PassStatus.Active`
- **THEN** the value is the string `'active'`
- **THEN** the enum includes `Active`, `Used`, `Expired`, and `Revoked`

### Requirement: Pass entity and DTOs

The shared package SHALL define the access pass contract.

#### Scenario: Access pass type
- **WHEN** a developer inspects `AccessPass`
- **THEN** it includes `id`, `communityId`, `unitId`, `createdBy`, `type`,
  `holderName`, `validFrom`, `validUntil`, `maxUses`, `usedCount`, `status`,
  `credentialId`, `accessPointIds`

#### Scenario: Create pass DTO
- **WHEN** a developer inspects `CreateAccessPassDto`
- **THEN** it includes `unitId`, `type`, `holderName`, `holderDocument?`, `validFrom`,
  `validUntil`, `maxUses`, `accessPointIds?`, `metadata?`

#### Scenario: Issue token response
- **WHEN** a developer inspects `PassTokenResponse`
- **THEN** it includes `passId`, `token`, `expiresAt`, and `maxUses`
- **THEN** it does not include the credential secret

#### Scenario: Scan response
- **WHEN** a developer inspects `ScanPassResponse`
- **THEN** it includes `decision`, `reason`, `passId?`, `accessPointId`, and
  `occurredAt`
