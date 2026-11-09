## ADDED Requirements

### Requirement: Generic device command publishing

The MQTT bridge SHALL publish commands to normalized per-device topics.

#### Scenario: Publish device command
- **WHEN** the bridge receives a command for `community/{communityId}/device/{deviceId}/cmd`
- **THEN** it publishes the payload with `requestId`, `command`, and `params`

#### Scenario: Invalid command payload
- **WHEN** the payload is missing `requestId` or `command`
- **THEN** the bridge rejects it with a validation error

### Requirement: Device ack subscription

The bridge SHALL subscribe to device ack topics and update command state.

#### Scenario: Ack forwarding
- **WHEN** a message arrives on `community/{communityId}/device/{deviceId}/ack`
- **THEN** the bridge forwards `{ requestId, result }` to the command worker

#### Scenario: Unknown request id
- **WHEN** an ack references an unknown `requestId`
- **THEN** the bridge records a warning and ignores it

### Requirement: Device state and events

The bridge SHALL forward device state and hardware events.

#### Scenario: State update
- **WHEN** a message arrives on `community/{communityId}/device/{deviceId}/state`
- **THEN** the bridge updates device status and last seen

#### Scenario: Hardware event
- **WHEN** a message arrives on `community/{communityId}/device/{deviceId}/event`
- **THEN** the bridge emits an operational event with the device id

### Requirement: Legacy relay topics

The bridge SHALL keep processing legacy relay topics during migration.

#### Scenario: Legacy relay command
- **WHEN** a message arrives on `porteria/{buildingId}/relay/{relayIndex}/set`
- **THEN** the bridge processes it as before
- **THEN** it emits a deprecation warning
