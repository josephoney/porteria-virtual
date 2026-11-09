## ADDED Requirements

### Requirement: Versioned consent

The system SHALL record biometric consent with the policy version in force.

#### Scenario: Grant consent

- **WHEN** a user grants consent
- **THEN** a `biometric_consents` row is created with `policy_version`, `granted_at`,
  `status = 'active'`, and an evidence reference

#### Scenario: Policy version changes

- **WHEN** the privacy policy version changes
- **THEN** existing consents remain valid for their recorded version
- **THEN** the system can request re-consent without silently reusing the old one

#### Scenario: Consent required for verification

- **WHEN** a user has no active consent
- **THEN** biometric verification is not performed

### Requirement: Withdrawal and deletion

Users SHALL be able to withdraw consent and request deletion of their biometric data.

#### Scenario: Withdraw consent

- **WHEN** a user withdraws consent
- **THEN** the consent status becomes `revoked`
- **THEN** the associated templates are deleted or anonymized
- **THEN** the biometric credential is disabled
- **THEN** the user falls back to QR

#### Scenario: Withdrawal propagation

- **WHEN** consent is revoked
- **THEN** the revocation is included in the policy delta
- **THEN** edge devices delete the cached template on the next sync

#### Scenario: Deletion confirmation

- **WHEN** deletion completes
- **THEN** the system records `biometric.template_deleted` without the template itself

### Requirement: Data subject access and export

The system SHALL let a user know what biometric data exists and export their record.

#### Scenario: Inspect biometric record

- **WHEN** a user requests their biometric record
- **THEN** the response includes consent status, provider, mode, template status, and
  enrollment dates
- **THEN** it never returns the template or image

#### Scenario: Export

- **WHEN** a user requests an export
- **THEN** the system provides a machine-readable record of their biometric metadata

### Requirement: Access control on biometric data

Only authorized roles SHALL access biometric metadata.

#### Scenario: Admin access

- **WHEN** an `org_admin` or `community_admin` requests enrollment metadata
- **THEN** they see metadata within their community

#### Scenario: Guard access

- **WHEN** a guard requests biometric metadata
- **THEN** they only see whether a user is enrolled, not templates or scores

#### Scenario: Resident access

- **WHEN** a resident requests another user's biometric metadata
- **THEN** the response has status 403

### Requirement: Retention policy

Biometric data SHALL have a configurable retention and purge policy.

#### Scenario: Consent revoked retention

- **WHEN** consent is revoked
- **THEN** templates are purged within the configured grace period

#### Scenario: Inactive account

- **WHEN** a user is inactive beyond the retention window
- **THEN** their templates are purged
- **THEN** the purge is audited

#### Scenario: Purge verification

- **WHEN** a purge runs
- **THEN** it reports the number of templates deleted and any failures

### Requirement: Biometric audit events

The system SHALL audit all biometric lifecycle events.

#### Scenario: Consent events

- **WHEN** consent is granted or revoked
- **THEN** `biometric.consent_granted` or `biometric.consent_revoked` is recorded

#### Scenario: Template events

- **WHEN** a template is created, replaced, or deleted
- **THEN** the corresponding event is recorded

#### Scenario: Audit contents

- **WHEN** any biometric event is recorded
- **THEN** it contains ids, operation, result, and timestamp
- **THEN** it contains no embedding, image, or template
