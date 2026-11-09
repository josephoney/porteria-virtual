## ADDED Requirements

### Requirement: Provider interface

The system SHALL define a `BiometricProvider` interface implemented by every biometric
backend.

#### Scenario: Interface operations
- **WHEN** a provider is implemented
- **THEN** it exposes `enroll`, `verify`, `identify`, `delete`, and `health`

#### Scenario: Enroll operation
- **WHEN** `enroll(subject, imageOrEmbedding, options)` is called
- **THEN** it returns a template reference, algorithm, quality score, and liveness
  result

#### Scenario: Verify operation
- **WHEN** `verify(subject, capture, options)` is called
- **THEN** it returns `{ match, score, liveness, providerRef }`

#### Scenario: Identify operation
- **WHEN** `identify(capture, gallery, options)` is called
- **THEN** it returns the best candidate and score, or no candidate

### Requirement: Provider configuration per community

Each community SHALL configure its biometric provider and mode.

#### Scenario: Configure provider
- **WHEN** an admin selects `edge`, `on_prem`, or `cloud` for a community
- **THEN** the configuration is stored with endpoint/credentials references
- **THEN** secrets are stored in a secret manager or encrypted config, not in plain
  columns

#### Scenario: Provider capabilities
- **WHEN** a provider is configured
- **THEN** the system records its capabilities: liveness, modes, max gallery, algorithm

#### Scenario: Missing liveness capability
- **WHEN** a provider does not support liveness
- **THEN** the community cannot enable biometric access

### Requirement: Provider health and fallback

The system SHALL detect provider failures and degrade gracefully.

#### Scenario: Health check failure
- **WHEN** `health()` fails repeatedly
- **THEN** the community is marked `biometric_degraded`
- **THEN** access falls back to QR and the point's failure policy

#### Scenario: Timeout
- **WHEN** a provider call exceeds the configured timeout
- **THEN** the verification fails with `provider_timeout`
- **THEN** the attempt is audited

#### Scenario: Recovery
- **WHEN** health checks succeed again
- **THEN** the community returns to `biometric_operational`
- **THEN** the recovery is audited

### Requirement: Provider swap without data loss

Changing the provider SHALL be possible without silently losing templates.

#### Scenario: Swap provider
- **WHEN** an admin changes the provider for a community
- **THEN** existing templates are re-enrolled or migrated explicitly
- **THEN** templates that cannot be migrated are marked `requires_reenrollment`
- **THEN** affected users fall back to QR until re-enrolled

#### Scenario: Provider deletion
- **WHEN** a provider is removed
- **THEN** its template references are deleted or invalidated
- **THEN** the deletion is audited

### Requirement: No sensitive leakage in logs

Provider integration SHALL NOT log sensitive payloads.

#### Scenario: Error logging
- **WHEN** a provider call fails
- **THEN** the log includes only provider name, operation, status, and correlation id
- **THEN** images, embeddings, and templates are never logged
