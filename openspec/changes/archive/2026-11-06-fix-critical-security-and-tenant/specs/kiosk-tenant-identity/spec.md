## ADDED Requirements

### Requirement: Kiosk identity resolution

A kiosk SHALL resolve to exactly one community and organization.

#### Scenario: Unique rpi id
- **WHEN** a kiosk registers with `rpiId`
- **THEN** the server resolves exactly one kiosk
- **THEN** the kiosk's community and organization are unambiguous

#### Scenario: Duplicate rpi id
- **WHEN** the migration finds two kiosks with the same `rpi_id`
- **THEN** it renames the legacy one or removes the legacy organization if it has no
  memberships
- **THEN** the migration reports the affected rows

#### Scenario: Resolve by community
- **WHEN** `rpi_id` is kept community-scoped
- **THEN** the resolve endpoint requires `communityId + rpiId`
- **THEN** an ambiguous request is rejected with 409

### Requirement: Legacy data cleanup

The migration SHALL not leave orphan tenant data.

#### Scenario: Legacy organization without memberships
- **WHEN** an organization has zero memberships and is marked legacy
- **THEN** its communities, kiosks, and calls are removed or migrated according to the
  backup policy

#### Scenario: New demo organization
- **WHEN** the seed runs after cleanup
- **THEN** the new kiosk has a unique `rpi_id`
- **THEN** new calls are associated with the new organization/community

### Requirement: Correct call/event association

New calls and events SHALL use the resolved kiosk community.

#### Scenario: Call created from kiosk
- **WHEN** a call is created from `edificio-01`
- **THEN** the call's `community_id` matches the resolved kiosk
- **THEN** the org admin of that community sees the call

#### Scenario: Old call data
- **WHEN** legacy calls are retained
- **THEN** they remain associated with the legacy organization
- **THEN** they are not shown to the new organization's admins
