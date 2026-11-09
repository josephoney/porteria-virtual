## ADDED Requirements

### Requirement: Biometric enums

The shared package SHALL define enums for biometric modes, providers, and consent.

#### Scenario: Biometric mode enum
- **WHEN** a developer uses `BiometricMode.OneToOne`
- **THEN** the value is the string `'1:1'`
- **THEN** the enum includes `OneToOne` (`1:1`) and `OneToMany` (`1:N`)

#### Scenario: Provider kind enum
- **WHEN** a developer uses `BiometricProviderKind.Edge`
- **THEN** the value is the string `'edge'`
- **THEN** the enum includes `Edge`, `OnPrem`, and `Cloud`

#### Scenario: Consent status enum
- **WHEN** a developer uses `BiometricConsentStatus.Active`
- **THEN** the value is the string `'active'`
- **THEN** the enum includes `Active`, `Revoked`, and `Expired`

### Requirement: Biometric entity types

The shared package SHALL define types for consent, templates, and provider config.

#### Scenario: Consent type
- **WHEN** a developer inspects `BiometricConsent`
- **THEN** it includes `id`, `userId`, `communityId`, `policyVersion`, `status`,
  `grantedAt`, `revokedAt`

#### Scenario: Template type
- **WHEN** a developer inspects `BiometricTemplate`
- **THEN** it includes `id`, `userId`, `communityId`, `provider`, `algorithm`,
  `qualityScore`, `status`, `createdAt`
- **THEN** it does NOT include the encrypted template value

#### Scenario: Provider config type
- **WHEN** a developer inspects `BiometricProviderConfig`
- **THEN** it includes `communityId`, `provider`, `mode`, `threshold1to1`,
  `threshold1toN`, `maxGallery`, `livenessRequired`, `status`

### Requirement: Biometric DTOs

The shared package SHALL define enrollment and verification DTOs.

#### Scenario: Enrollment request
- **WHEN** a developer inspects `EnrollBiometricRequest`
- **THEN** it includes `userId`, `communityId`, `capture`, and `consentId`

#### Scenario: Verification request
- **WHEN** a developer inspects `VerifyBiometricRequest`
- **THEN** it includes `communityId`, `accessPointId`, `mode`, `subjectId?`, and
  `capture`

#### Scenario: Verification response
- **WHEN** a developer inspects `VerifyBiometricResponse`
- **THEN** it includes `matched`, `score`, `liveness`, `subjectId?`, `reason`, and
  `provider`
