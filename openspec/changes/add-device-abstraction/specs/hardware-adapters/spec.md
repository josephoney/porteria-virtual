## ADDED Requirements

### Requirement: Device driver interface

The system SHALL define a `DeviceDriver` interface implemented per device type.

#### Scenario: Driver operations
- **WHEN** a driver is implemented
- **THEN** it exposes `open`, `close`, `status`, `identify`, and `reboot`

#### Scenario: Open operation
- **WHEN** `open(device, params)` is called
- **THEN** the driver publishes the correct command and returns an ack request id

#### Scenario: Status operation
- **WHEN** `status(device)` is called
- **THEN** the driver returns the device state and last seen

### Requirement: Driver registry

The system SHALL resolve a driver from the device `driver` field.

#### Scenario: Known driver
- **WHEN** a device references a registered driver
- **THEN** the registry returns its implementation

#### Scenario: Unknown driver
- **WHEN** a device references an unregistered driver
- **THEN** the command is rejected with `unsupported_driver`

#### Scenario: Driver capabilities
- **WHEN** a driver is registered
- **THEN** it declares the capabilities it supports

### Requirement: MQTT command topics

The system SHALL use normalized MQTT topics per device.

#### Scenario: Command topic
- **WHEN** a command is published
- **THEN** it goes to `community/{communityId}/device/{deviceId}/cmd`
- **THEN** the payload includes `requestId`, `command`, and `params`

#### Scenario: Ack topic
- **WHEN** a device acknowledges a command
- **THEN** it publishes to `community/{communityId}/device/{deviceId}/ack`
- **THEN** the payload includes `requestId` and `result`

#### Scenario: State topic
- **WHEN** a device reports state
- **THEN** it publishes to `community/{communityId}/device/{deviceId}/state`

#### Scenario: Event topic
- **WHEN** a device reports a hardware event
- **THEN** it publishes to `community/{communityId}/device/{deviceId}/event`

### Requirement: Relay compatibility

The system SHALL keep relay outputs working during migration.

#### Scenario: Relay device
- **WHEN** a `relay_outputs` row is associated with a `relay_board` or `kiosk` device
- **THEN** opening the relay maps to a `device_command` for that device

#### Scenario: Legacy topic
- **WHEN** a legacy `porteria/{buildingId}/relay/{index}/set` message is received
- **THEN** the bridge still processes it for backward compatibility
- **THEN** it emits a deprecation warning

### Requirement: Error mapping

Drivers SHALL map hardware errors to stable codes.

#### Scenario: Timeout
- **WHEN** the device does not respond
- **THEN** the driver returns `device_timeout`

#### Scenario: Rejected command
- **WHEN** the hardware rejects the command
- **THEN** the driver returns `device_rejected` with a safe message

#### Scenario: Unknown error
- **WHEN** an unexpected error occurs
- **THEN** the driver returns `device_error` without leaking internals
