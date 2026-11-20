## ADDED Requirements

### Requirement: Legacy units deprecation

The fixed `buildings`/`units` model SHALL be deprecated in favor of the generic location
hierarchy.

#### Scenario: New communities
- **WHEN** a community is created after this change
- **THEN** its structure is created with `location_structures`/`location_units`
- **THEN** it does not require `buildings`/`units` rows

#### Scenario: Existing communities
- **WHEN** an existing community is migrated
- **THEN** its buildings/units are mapped to the default structure
- **THEN** the old rows remain readable until the migration is verified

### Requirement: Reference migration

References to the legacy `unit_id` SHALL be migrated.

#### Scenario: Resident memberships
- **WHEN** a membership references a legacy `unit_id`
- **THEN** it is linked to the corresponding `location_unit_id`

#### Scenario: QR passes
- **WHEN** a pass references a legacy `unit_id`
- **THEN** it is scheduled for migration to `location_unit_id` (proposal 7)

#### Scenario: Rollback
- **WHEN** the migration is rolled back
- **THEN** legacy references are restored where possible
