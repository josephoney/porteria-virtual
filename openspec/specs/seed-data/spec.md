## Purpose

Deterministic demo data for local development and testing.
## Requirements
### Requirement: Seed script executable
The project SHALL have a seed script that populates the database with demo data for development and testing.

#### Scenario: Run seed script
- **WHEN** developer runs `pnpm --filter @porteria/database db:seed`
- **THEN** demo data is inserted into all tables without errors

#### Scenario: Idempotent seed
- **WHEN** the seed script is run multiple times
- **THEN** it does not duplicate data (uses ON CONFLICT or clears previous seed data)

### Requirement: Demo organization
The seed script SHALL create two demo organizations to exercise multi-tenancy, each
with at least one community.

#### Scenario: Organizations exist after seed
- **WHEN** the seed script completes
- **THEN** querying `organizations` returns at least two rows, including
  `name = 'Administradora Demo'` and `name = 'Comunidad Independiente Demo'`

#### Scenario: Communities per organization
- **WHEN** the seed script completes
- **THEN** each demo organization has at least one community
- **THEN** one organization has a community with two buildings and several units

### Requirement: Demo users
The seed script SHALL create users and memberships covering the platform and tenant
roles.

#### Scenario: Platform admin user
- **WHEN** the seed script completes
- **THEN** a user with `is_platform_admin = true` and
  `email = 'superadmin@porteria.local'` exists
- **THEN** the password is hashed with bcrypt

#### Scenario: Organization admin user
- **WHEN** the seed script completes
- **THEN** a user with an active `org_admin` membership exists

#### Scenario: Community staff users
- **WHEN** the seed script completes
- **THEN** users with `community_admin`, `operator`, and `guard` memberships exist,
  each scoped to a community

#### Scenario: Resident users
- **WHEN** the seed script completes
- **THEN** users with `owner` and `resident` memberships exist and are linked to units

### Requirement: Demo access point and kiosk
The seed script SHALL create an access point and associated kiosk for a demo
community.

#### Scenario: Access point exists
- **WHEN** the seed script completes
- **THEN** an access point with `type = 'door'` and `gpio_pin = 17` exists in a demo
  community

#### Scenario: Kiosk linked
- **WHEN** the seed script completes
- **THEN** a kiosk is linked to the demo community and to the demo access point

#### Scenario: Relay outputs preserved
- **WHEN** the seed script completes
- **THEN** the demo kiosk has its relay outputs for door, gate, hall light, and alarm

