## ADDED Requirements

### Requirement: Relay outputs table
The system SHALL store relay output configurations in a `relay_outputs` table linked to kiosks.

#### Scenario: Create relay output
- **WHEN** a relay output is created with `kiosk_id`, `relay_index`, `gpio_pin`, `label`, and `mode`
- **THEN** the row is persisted with an auto-generated UUID and timestamps

#### Scenario: Unique relay index per kiosk
- **WHEN** a relay output is inserted with a `relay_index` that already exists for the same `kiosk_id`
- **THEN** the database rejects the insertion with a unique constraint violation

#### Scenario: Unique GPIO pin per kiosk
- **WHEN** a relay output is inserted with a `gpio_pin` that already exists for the same `kiosk_id`
- **THEN** the database rejects the insertion with a unique constraint violation

#### Scenario: Cascade delete on kiosk removal
- **WHEN** a kiosk is deleted
- **THEN** all its associated relay outputs are automatically deleted

### Requirement: Relay modes
The system SHALL support two relay operating modes: momentary and latch.

#### Scenario: Momentary mode
- **WHEN** a relay is configured with `mode = 'momentary'` and `duration_ms = 5000`
- **THEN** triggering the relay activates the GPIO for exactly 5000ms then deactivates it

#### Scenario: Latch mode
- **WHEN** a relay is configured with `mode = 'latch'`
- **THEN** each trigger toggles the GPIO state between ON and OFF

### Requirement: API relay lookup
The API server SHALL provide endpoints to retrieve relay configurations for a kiosk.

#### Scenario: List relays by kiosk
- **WHEN** `GET /api/kiosks/:kioskId/relays` is called with valid JWT
- **THEN** all relay outputs for that kiosk are returned with id, relay_index, gpio_pin, label, mode, duration_ms, and access_point_id

#### Scenario: Find relay by access point
- **WHEN** `POST /api/internal/relays/trigger` is called with `kioskId` and `accessPointId`
- **THEN** the relay output linked to that access point and kiosk is found and triggered

### Requirement: Internal relay trigger
The API server SHALL expose an internal endpoint to trigger relay activation.

#### Scenario: Trigger momentary relay
- **WHEN** `POST /api/internal/relays/trigger` is called with valid API key, `kioskId`, `relayIndex`, and relay is momentary
- **THEN** the relay configuration is looked up and a request is forwarded to the MQTT bridge with `state: "ON"` and `durationMs`

#### Scenario: Trigger latch relay
- **WHEN** `POST /api/internal/relays/trigger` is called with valid API key, `kioskId`, `relayIndex`, and relay is latch
- **THEN** the relay configuration is looked up and a request is forwarded to the MQTT bridge with `state: "TOGGLE"`

#### Scenario: Reject unauthenticated trigger
- **WHEN** `POST /api/internal/relays/trigger` is called without a valid `X-Internal-Key`
- **THEN** the request is rejected with 401 Unauthorized

#### Scenario: MQTT bridge unavailable
- **WHEN** the MQTT bridge is unreachable during trigger
- **THEN** the API returns a 502 error and the signaling server logs a warning (fire-and-forget does not block call flow)
