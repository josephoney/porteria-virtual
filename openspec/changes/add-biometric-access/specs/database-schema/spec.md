## ADDED Requirements

### Requirement: Biometric consents table

The system SHALL have a `biometric_consents` table recording consent per user,
community, and policy version.

#### Scenario: Consent columns
- **WHEN** the schema is inspected
- **THEN** `biometric_consents` includes `id`, `user_id`, `community_id`,
  `policy_version`, `status`, `granted_at`, `revoked_at`, `evidence_ref`, timestamps

#### Scenario: One active consent per user and community
- **WHEN** a new active consent is inserted for a user and community that already has an
  active consent
- **THEN** the previous active consent is revoked or the insertion is rejected

### Requirement: Biometric templates table

The system SHALL have a `biometric_templates` table storing encrypted templates or
provider references.

#### Scenario: Template columns
- **WHEN** the schema is inspected
- **THEN** `biometric_templates` includes `id`, `user_id`, `community_id`, `provider`,
  `algorithm`, `encrypted_template`, `template_ref`, `quality_score`, `status`,
  `consent_id`, `created_at`, `updated_at`, `deleted_at`

#### Scenario: Template index
- **WHEN** the migration is applied
- **THEN** an index exists on `(community_id, status)` and `(user_id, status)`

#### Scenario: Template references consent
- **WHEN** a template is stored
- **THEN** `consent_id` references an active consent

### Requirement: Biometric provider configs table

The system SHALL have a `biometric_provider_configs` table per community.

#### Scenario: Provider config columns
- **WHEN** the schema is inspected
- **THEN** `biometric_provider_configs` includes `id`, `community_id`, `provider`
  (`edge` | `on_prem` | `cloud`), `mode` (`1:1` | `1:N`), `threshold_1to1`,
  `threshold_1toN`, `max_gallery`, `liveness_required`, `config_ref`, `status`,
  timestamps

#### Scenario: One config per community
- **WHEN** a second config is inserted for the same community
- **THEN** the database rejects it with a unique constraint violation
