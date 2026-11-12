## ADDED Requirements

### Requirement: Named access points

The system SHALL let each community define one or more named access points
(porterías/portones).

#### Scenario: Create an access point

- **WHEN** a community admin creates an access point with a name
- **THEN** the row stores `community_id`, `name`, `type`, `direction` and `active`
- **THEN** the name is unique within the community

#### Scenario: Duplicate name

- **WHEN** a second access point with the same name is created in the same community
- **THEN** the database rejects it with a unique constraint violation
- **THEN** the API returns 409

#### Scenario: Same name in another community

- **WHEN** two communities create an access point with the same name
- **THEN** both are accepted

### Requirement: Access point CRUD

The system SHALL expose CRUD for access points scoped to the community.

#### Scenario: List active access points

- **WHEN** a guard lists access points for their community
- **THEN** only active access points are returned
- **THEN** each item includes `id`, `name`, `type` and `direction`

#### Scenario: List all for admins

- **WHEN** a community or organization admin lists access points
- **THEN** inactive access points are included

#### Scenario: Update

- **WHEN** an admin updates the name, type or direction
- **THEN** the change is persisted
- **THEN** the previous bitácora entries keep their `access_point_name` snapshot

#### Scenario: Deactivate

- **WHEN** an admin deactivates an access point
- **THEN** `active = false`
- **THEN** new shifts cannot start there
- **THEN** existing history is preserved

#### Scenario: Cross-community access

- **WHEN** a community admin targets an access point of another community
- **THEN** the response has status 403

### Requirement: Optional GPIO

The system SHALL allow access points without a GPIO pin.

#### Scenario: QR-only access point

- **WHEN** an access point is created without `gpio_pin`
- **THEN** the row is accepted with `gpio_pin = NULL`

#### Scenario: Relay access point

- **WHEN** an access point is created with a GPIO pin
- **THEN** the value is persisted for relay control

### Requirement: Access direction

The system SHALL validate scan direction against the access point configuration.

#### Scenario: Entry-only access point

- **WHEN** a pass is scanned for exit at an `entry` access point
- **THEN** the scan is denied with reason `wrong_direction`

#### Scenario: Exit-only access point

- **WHEN** a pass is scanned for entry at an `exit` access point
- **THEN** the scan is denied with reason `wrong_direction`

#### Scenario: Both directions

- **WHEN** the access point direction is `both`
- **THEN** entry and exit scans are allowed
