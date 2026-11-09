## ADDED Requirements

### Requirement: Consent required before enrollment

The system SHALL refuse biometric enrollment without an active, versioned consent.

#### Scenario: Enrollment with consent

- **WHEN** an operator starts enrollment for a user with an active consent for the
  current policy version
- **THEN** the enrollment flow proceeds

#### Scenario: Enrollment without consent

- **WHEN** a user has no active consent
- **THEN** the enrollment is rejected with reason `consent_required`

#### Scenario: Consent for another community

- **WHEN** the consent was granted for a different community
- **THEN** the enrollment is rejected

### Requirement: Enrollment capture and quality

The enrollment flow SHALL validate identity, liveness, and image quality before
creating a template.

#### Scenario: Successful capture

- **WHEN** the provider returns a liveness pass and a quality score above the configured
  minimum
- **THEN** a template is created for the user

#### Scenario: Liveness failure

- **WHEN** liveness fails during enrollment
- **THEN** no template is created
- **THEN** the response has status 422 with reason `liveness_failed`

#### Scenario: Low quality

- **WHEN** the quality score is below the minimum
- **THEN** no template is created
- **THEN** the response asks for a new capture

#### Scenario: Multiple templates per user

- **WHEN** a user needs better recognition (glasses, angles)
- **THEN** additional templates can be enrolled up to the configured limit

### Requirement: Template storage

The system SHALL store only an encrypted template or a provider reference.

#### Scenario: Template persisted

- **WHEN** enrollment succeeds
- **THEN** a `biometric_templates` row is stored with `provider`, `algorithm`,
  `quality_score`, `status`, and an encrypted template or provider `template_ref`

#### Scenario: No raw image by default

- **WHEN** enrollment completes
- **THEN** the raw image is discarded after template generation
- **THEN** no raw image is stored unless a separate image-retention consent is active

#### Scenario: Encryption at rest

- **WHEN** a template is stored
- **THEN** it is encrypted with a tenant-scoped key
- **THEN** the key is not stored next to the template

### Requirement: Duplicate detection

The system SHALL prevent the same face from being enrolled for two different users in
the same community.

#### Scenario: Duplicate face

- **WHEN** a new template matches an existing user above the duplicate threshold
- **THEN** the enrollment is rejected with reason `duplicate_biometric`
- **THEN** the response does not disclose the matched user

#### Scenario: Re-enrollment of the same user

- **WHEN** the same user re-enrolls
- **THEN** the previous template is deactivated according to the replacement policy

### Requirement: Enrollment API

The API SHALL expose enrollment endpoints restricted to authorized roles.

#### Scenario: Operator enrolls

- **WHEN** an operator or community admin submits an enrollment for a user in their
  community
- **THEN** the enrollment is processed

#### Scenario: Unauthorized role

- **WHEN** a resident attempts to enroll another user
- **THEN** the response has status 403

#### Scenario: Enrollment audit

- **WHEN** an enrollment succeeds or fails
- **THEN** a `biometric.enrolled` or `biometric.enrollment_failed` event is recorded
- **THEN** the event contains no template or image data
