## ADDED Requirements

### Requirement: Device enums

The shared package SHALL define device types, statuses, and command statuses.

#### Scenario: Device type enum
- **WHEN** a developer uses `DeviceType.FaceReader`
- **THEN** the value is the string `'face_reader'`
- **THEN** the enum includes `Kiosk`, `FaceReader`, `QrReader`, `Turnstile`, `Barrier`,
  `RelayBoard`, and `Intercom`

#### Scenario: Device status enum
- **WHEN** a developer uses `DeviceStatus.Online`
- **THEN** the value is the string `'online'`
- **THEN** the enum includes `Online`, `Offline`, `Degraded`, and `Maintenance`

#### Scenario: Command status enum
- **WHEN** a developer uses `DeviceCommandStatus.Pending`
- **THEN** the value is the string `'pending'`
- **THEN** the enum includes `Pending`, `Sent`, `Acked`, `Failed`, and `Expired`

### Requirement: Device entity and DTOs

The shared package SHALL define the device and command contracts.

#### Scenario: Device type
- **WHEN** a developer inspects `Device`
- **THEN** it includes `id`, `communityId`, `accessPointId`, `name`, `type`, `driver`,
  `capabilities`, `status`, `lastSeenAt`

#### Scenario: Device command type
- **WHEN** a developer inspects `DeviceCommand`
- **THEN** it includes `id`, `deviceId`, `command`, `payload`, `requestId`, `status`,
  `attempts`, `sentAt`, `ackedAt`, `lastError`

#### Scenario: Driver contract type
- **WHEN** a developer inspects `DeviceDriver`
- **THEN** it includes `open`, `close`, `status`, `identify`, and `reboot` signatures

#### Scenario: Provision response
- **WHEN** a developer inspects `ProvisionDeviceResponse`
- **THEN** it includes `deviceId`, `deviceToken`, and `mqttTopicBase`
