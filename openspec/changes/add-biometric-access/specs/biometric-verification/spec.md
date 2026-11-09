## ADDED Requirements

### Requirement: 1:1 verification by default

The default biometric mode SHALL be verification against a known subject.

#### Scenario: Successful 1:1 verification

- **WHEN** a user identifies with PIN or card and the provider confirms the face matches
  their template above the 1:1 threshold
- **THEN** the access engine receives a successful biometric credential

#### Scenario: Failed 1:1 verification

- **WHEN** the face does not match the claimed subject
- **THEN** the access engine receives a failed credential with reason `biometric_mismatch`

#### Scenario: Missing template

- **WHEN** the subject has no active template
- **THEN** the verification fails with reason `no_template`

### Requirement: Scoped 1:N identification (opt-in)

A community SHALL be able to enable 1:N identification with explicit safeguards.

#### Scenario: Community enables 1:N

- **WHEN** a community admin enables 1:N and the gallery size is within the configured
  limit
- **THEN** walk-up identification is available

#### Scenario: Gallery limit exceeded

- **WHEN** the gallery exceeds the configured maximum for 1:N
- **THEN** enabling 1:N is rejected with a clear error

#### Scenario: 1:N match

- **WHEN** the best match exceeds the 1:N threshold
- **THEN** the subject is identified and the access engine evaluates the credential

#### Scenario: No confident match

- **WHEN** no candidate exceeds the 1:N threshold
- **THEN** the access engine receives `unknown_biometric`
- **THEN** no identity is disclosed

### Requirement: Liveness mandatory

Every verification SHALL require a passed liveness check.

#### Scenario: Liveness passed

- **WHEN** the provider reports liveness pass
- **THEN** verification continues

#### Scenario: Liveness failed or unavailable

- **WHEN** liveness fails or the provider cannot perform it
- **THEN** the verification is denied with reason `liveness_failed`
- **THEN** the response offers QR as fallback

### Requirement: Thresholds and modes per community

The system SHALL store biometric mode and thresholds per community.

#### Scenario: Configure thresholds

- **WHEN** an admin sets 1:1 and 1:N thresholds for a community
- **THEN** the values are persisted and versioned with the access policy

#### Scenario: Invalid threshold

- **WHEN** a threshold is outside the allowed range
- **THEN** the update is rejected with status 400

#### Scenario: Mode change

- **WHEN** a community switches between 1:1 and 1:N
- **THEN** the change is audited
- **THEN** active sessions use the new mode on the next verification

### Requirement: Fallback to QR

Biometric verification SHALL always have a non-biometric fallback.

#### Scenario: User declines biometrics

- **WHEN** a user has no template or revoked consent
- **THEN** their QR credential remains usable

#### Scenario: Provider unavailable

- **WHEN** the biometric provider is unhealthy
- **THEN** the access point offers QR and applies its configured failure policy

### Requirement: Offline biometric verification

Edge devices SHALL verify against locally cached encrypted templates.

#### Scenario: Offline 1:1 verification

- **WHEN** the device has a valid snapshot and cached templates and loses connectivity
- **THEN** it performs 1:1 verification locally

#### Scenario: Offline revocation

- **WHEN** a consent is revoked and the device syncs the delta
- **THEN** the cached template is deleted and further offline matches are denied

#### Scenario: Stale template cache

- **WHEN** the cached template set is older than the configured TTL
- **THEN** the device requires a sync before allowing biometric offline access
- **THEN** it falls back to QR and the point's failure policy

### Requirement: Verification rate limiting

The API and provider SHALL protect against brute-force and replay.

#### Scenario: Excessive attempts

- **WHEN** a subject or device exceeds the configured biometric attempts per minute
- **THEN** further attempts are rejected with status 429

#### Scenario: Replay of a captured frame

- **WHEN** a replayed or synthetic image is detected
- **THEN** the verification fails with `liveness_failed` and a security event is recorded

### Requirement: Audit

Biometric verification outcomes SHALL be audited without sensitive data.

#### Scenario: Success audit

- **WHEN** verification succeeds
- **THEN** a `biometric.verify_success` event is recorded with subject id, provider,
  mode, and access point

#### Scenario: Failure audit

- **WHEN** verification fails
- **THEN** a `biometric.verify_failed` event is recorded with the reason
- **THEN** no embedding, image, or template is recorded
