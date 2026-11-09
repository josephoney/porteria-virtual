## ADDED Requirements

### Requirement: Access credential types

The shared package SHALL define types and enums for access credentials.

#### Scenario: Credential type enum

- **WHEN** a developer uses `CredentialType.Qr`
- **THEN** the value is the string `'qr'`
- **THEN** the enum includes `Qr`, `Pin`, `Rfid`, `Biometric`, `Plate`

#### Scenario: Credential entity type

- **WHEN** a developer inspects the `Credential` type
- **THEN** it includes `id`, `communityId`, `type`, `subjectType`, `subjectId`,
  `status`, `validFrom`, `validUntil`, `maxUses`, `usedCount`

#### Scenario: Credential subject type

- **WHEN** a developer inspects `CredentialSubjectType`
- **THEN** it includes `user`, `visitor`, and `vehicle`

### Requirement: Access rule types

The shared package SHALL define types for rules and policies.

#### Scenario: Rule entity type

- **WHEN** a developer inspects the `AccessRule` type
- **THEN** it includes `id`, `communityId`, `accessPointId`, `subjectScope`, `effect`,
  `schedule`, `validFrom`, `validUntil`, `maxUses`

#### Scenario: Fail policy enum

- **WHEN** a developer uses `FailPolicy.Closed`
- **THEN** the value is the string `'closed'`
- **THEN** the enum includes `Open` and `Closed`

### Requirement: Access decision DTOs

The shared package SHALL define the verify request and response contracts.

#### Scenario: Verify request

- **WHEN** a developer inspects `VerifyAccessRequest`
- **THEN** it includes `requestId`, `deviceId`, `communityId`, `accessPointId`,
  `credential`, `direction`, `timestamp`

#### Scenario: Verify response

- **WHEN** a developer inspects `VerifyAccessResponse`
- **THEN** it includes `requestId`, `decision`, `reason`, `matchedRuleId`,
  `credentialId`, `subject`, `actuated`, `rulesVersion`

#### Scenario: Decision enum

- **WHEN** a developer uses `AccessDecision.Allow`
- **THEN** the value is the string `'allow'`
- **THEN** the enum includes `Allow` and `Deny`
