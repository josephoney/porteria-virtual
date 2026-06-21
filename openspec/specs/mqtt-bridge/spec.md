# MQTT Bridge

## Purpose

TBD — MQTT bridge service that connects to Mosquitto broker, publishes relay commands, and forwards relay status updates to dashboard clients via Socket.io.

## Requirements

### Requirement: MQTT client connection
The MQTT bridge SHALL connect to the Mosquitto broker on startup and expose connection state.

#### Scenario: Successful connection
- **WHEN** the bridge starts and Mosquitto is available
- **THEN** an MQTT client connects to the configured host and port
- **THEN** `/health` returns `{ mqtt: "connected" }`

#### Scenario: Connection failure
- **WHEN** Mosquitto is unavailable at startup
- **THEN** the bridge retries connection with exponential backoff
- **THEN** `/health` returns `{ mqtt: "disconnected" }`

### Requirement: Relay command publishing
The MQTT bridge SHALL publish relay commands to MQTT topics on request.

#### Scenario: Publish relay ON command
- **WHEN** `POST /relays/trigger` receives `{ buildingId, relayIndex, state: "ON", durationMs }`
- **THEN** a message is published to `porteria/{buildingId}/relay/{relayIndex}/set` with the payload `{ state: "ON", durationMs, requestId }`
- **THEN** the response is `{ ok: true, requestId }`

#### Scenario: Publish relay TOGGLE command
- **WHEN** `POST /relays/trigger` receives `{ buildingId, relayIndex, state: "TOGGLE" }`
- **THEN** a message is published with `{ state: "TOGGLE", requestId }`

#### Scenario: Invalid trigger body
- **WHEN** `POST /relays/trigger` receives a body missing required fields
- **THEN** the response is 400 with validation error details

### Requirement: Status subscription and forwarding
The MQTT bridge SHALL subscribe to relay status topics and forward updates to connected dashboard clients via Socket.io.

#### Scenario: Forward relay status to operators
- **WHEN** a status message is received on `porteria/+/relay/+/status`
- **THEN** the bridge emits `relay:status` event to all sockets in the 'operators' room with `{ buildingId, relayIndex, state, timestamp }`

#### Scenario: Dashboard receives status update
- **WHEN** a dashboard client is connected to the bridge's Socket.io and a relay status is received
- **THEN** the client receives the `relay:status` event and can update its UI accordingly

### Requirement: Health check with MQTT state
The MQTT bridge SHALL report MQTT connection state in its health endpoint.

#### Scenario: Health when MQTT connected
- **WHEN** `GET /health` is called and MQTT is connected
- **THEN** the response includes `{ status: "ok", service: "mqtt-bridge", mqtt: "connected", timestamp }`

#### Scenario: Health when MQTT disconnected
- **WHEN** `GET /health` is called and MQTT is disconnected
- **THEN** the response includes `{ status: "ok", service: "mqtt-bridge", mqtt: "disconnected", timestamp }`
