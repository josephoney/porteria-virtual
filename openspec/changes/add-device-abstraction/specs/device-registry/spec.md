## ADDED Requirements

### Requirement: Devices table

The system SHALL have a `devices` table representing physical access hardware.

#### Scenario: Device columns
- **WHEN** the schema is inspected
- **THEN** `devices` includes `id`, `community_id`, `access_point_id?`, `type`,
  `driver`, `identifier`, `secret_ref`, `capabilities`, `status`, `last_seen_at`,
  timestamps

#### Scenario: Device types
- **WHEN** a device is created
- **THEN** its type is one of `kiosk`, `face_reader`, `qr_reader`, `turnstile`,
  `barrier`, `relay_board`, `intercom`

#### Scenario: Multiple devices per access point
- **WHEN** a second device is assigned to an access point
- **THEN** the insertion is accepted

### Requirement: Device provisioning

The API SHALL provision devices with a scoped identity.

#### Scenario: Provision device
- **WHEN** an admin provisions a device for a community
- **THEN** a `deviceToken` is generated once and returned
- **THEN** only a hash or secret reference is stored

#### Scenario: Token rotation
- **WHEN** an admin rotates the device token
- **THEN** the previous token is invalidated
- **THEN** the device must re-authenticate

#### Scenario: Cross-community provisioning
- **WHEN** an admin tries to provision a device in another organization
- **THEN** the response has status 404

### Requirement: Device status and heartbeat

Devices SHALL report status and last-seen time.

#### Scenario: Heartbeat
- **WHEN** a device sends a heartbeat
- **THEN** `last_seen_at` is updated
- **THEN** its status becomes `online`

#### Scenario: Watchdog offline
- **WHEN** no heartbeat is received within the configured window
- **THEN** the device is marked `offline`
- **THEN** an operational event is emitted

#### Scenario: Maintenance mode
- **WHEN** an admin sets `status = 'maintenance'`
- **THEN** the device is excluded from access actuation but remains visible

### Requirement: Device capabilities

The system SHALL store and expose device capabilities.

#### Scenario: Capabilities
- **WHEN** a device is provisioned
- **THEN** `capabilities` records support for `liveness`, `qr`, `rfid`, `biometric`,
  `relay`, `barrier`, and `intercom`

#### Scenario: Unsupported command
- **WHEN** a command is requested that the device does not support
- **THEN** the command is rejected before publishing

### Requirement: Device management API

The API SHALL expose device management scoped by community.

#### Scenario: List devices
- **WHEN** an admin lists devices with `communityId` and optional `type`
- **THEN** the response is paginated with status and last seen

#### Scenario: Update device
- **WHEN** an admin updates name, access point, or status
- **THEN** the change is persisted and audited

#### Scenario: Unauthorized role
- **WHEN** a resident requests device management
- **THEN** the response has status 403
