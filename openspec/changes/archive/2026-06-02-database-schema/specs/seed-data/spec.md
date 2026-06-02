## ADDED Requirements

### Requirement: Seed script executable
The project SHALL have a seed script that populates the database with demo data for development and testing.

#### Scenario: Run seed script
- **WHEN** developer runs `pnpm --filter @porteria/database db:seed`
- **THEN** demo data is inserted into all tables without errors

#### Scenario: Idempotent seed
- **WHEN** the seed script is run multiple times
- **THEN** it does not duplicate data (uses ON CONFLICT or clears previous seed data)

### Requirement: Demo organization
The seed script SHALL create a demo organization with name "Edificio Demo" and one location.

#### Scenario: Organization exists after seed
- **WHEN** the seed script completes
- **THEN** querying `organizations` returns at least one row with `name = 'Edificio Demo'`

### Requirement: Demo users
The seed script SHALL create users with each role: admin, operator, guard, and resident.

#### Scenario: Admin user
- **WHEN** the seed script completes
- **THEN** a user with `role = 'admin'` and `email = 'admin@porteria.local'` exists
- **THEN** the password is hashed with bcrypt

#### Scenario: Operator user
- **WHEN** the seed script completes
- **THEN** a user with `role = 'operator'` exists

#### Scenario: Guard user
- **WHEN** the seed script completes
- **THEN** a user with `role = 'guard'` exists and is linked to the demo location

### Requirement: Demo access point and kiosk
The seed script SHALL create an access point and associated kiosk for the demo location.

#### Scenario: Access point exists
- **WHEN** the seed script completes
- **THEN** an access point with `type = 'door'` and `gpio_pin = 17` exists

#### Scenario: Kiosk linked
- **WHEN** the seed script completes
- **THEN** a kiosk is linked to the demo access point
