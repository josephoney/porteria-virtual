## ADDED Requirements

### Requirement: Credentials table

The system SHALL have a `credentials` table for access credentials scoped to a
community.

#### Scenario: Credential columns
- **WHEN** the schema is inspected
- **THEN** `credentials` includes `id`, `community_id`, `type`, `subject_type`,
  `subject_id`, `secret_hash`, `secret_ref`, `status`, `valid_from`, `valid_until`,
  `max_uses`, `used_count`, `created_by`, `created_at`, `updated_at`

#### Scenario: Credential indexes
- **WHEN** the migration is applied
- **THEN** indexes exist on `(community_id, status)` and
  `(subject_type, subject_id)`

### Requirement: Access rules table

The system SHALL have an `access_rules` table defining allow/deny rules.

#### Scenario: Rule columns
- **WHEN** the schema is inspected
- **THEN** `access_rules` includes `id`, `community_id`, `access_point_id?`,
  `subject_scope`, `subject_id?`, `effect`, `schedule` (JSONB), `valid_from?`,
  `valid_until?`, `max_uses?`, `anti_passback`, `priority`, `active`, timestamps

#### Scenario: Rule index
- **WHEN** the migration is applied
- **THEN** an index exists on `(community_id, access_point_id, active)`

### Requirement: Access logs table

The system SHALL have an append-only `access_logs` table.

#### Scenario: Access log columns
- **WHEN** the schema is inspected
- **THEN** `access_logs` includes `id`, `request_id`, `community_id`,
  `access_point_id`, `device_id`, `credential_id?`, `subject_type?`, `subject_id?`,
  `decision`, `reason`, `matched_rule_id?`, `direction`, `source`, `occurred_at`,
  `created_at`

#### Scenario: Access log index
- **WHEN** the migration is applied
- **THEN** indexes exist on `(community_id, created_at DESC)` and
  `(access_point_id, created_at DESC)`

#### Scenario: Unique request id
- **WHEN** a duplicate `request_id` is inserted for the same device
- **THEN** the database rejects the duplicate

### Requirement: Access point policy columns

Access points SHALL store the offline fallback policy.

#### Scenario: Policy columns
- **WHEN** the schema is inspected
- **THEN** `access_points` includes `fail_policy` (`open` | `closed`, default
  `closed`) and `direction` (`entry` | `exit` | `both`, default `both`)
