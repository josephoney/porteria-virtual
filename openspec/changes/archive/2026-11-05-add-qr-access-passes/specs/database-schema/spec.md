## ADDED Requirements

### Requirement: Access passes table

The system SHALL have an `access_passes` table representing issued QR passes.

#### Scenario: Pass columns
- **WHEN** the schema is inspected
- **THEN** `access_passes` includes `id`, `community_id`, `unit_id`, `created_by`,
  `type`, `holder_name`, `holder_document`, `valid_from`, `valid_until`, `max_uses`,
  `used_count`, `status`, `credential_id`, `metadata`, timestamps

#### Scenario: One credential per pass
- **WHEN** a pass is created
- **THEN** `credential_id` is unique and references a `qr` credential

#### Scenario: Pass indexes
- **WHEN** the migration is applied
- **THEN** indexes exist on `(community_id, status, valid_until)` and
  `(unit_id, created_at DESC)`

#### Scenario: Cascade rules
- **WHEN** a community or unit is deleted
- **THEN** its passes are deleted

### Requirement: Access point scope table

Passes SHALL be able to target multiple access points.

#### Scenario: Pass access points
- **WHEN** a pass targets access points
- **THEN** a join table `access_pass_points` stores `pass_id` and `access_point_id`

#### Scenario: Empty scope
- **WHEN** a pass has no explicit access points
- **THEN** the community policy determines the allowed points
