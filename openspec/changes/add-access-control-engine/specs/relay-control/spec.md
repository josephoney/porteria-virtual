## ADDED Requirements

### Requirement: Idempotent actuation request

The internal relay trigger SHALL accept an idempotency key so retries do not open a
door twice.

#### Scenario: Duplicate actuation
- **WHEN** `POST /api/internal/relays/trigger` is called twice with the same
  `requestId`
- **THEN** the second call returns the cached result
- **THEN** the relay is triggered only once

#### Scenario: Missing request id
- **WHEN** a request is made without `requestId`
- **THEN** the API generates one and returns it in the response

### Requirement: Access-originated actuation

The relay trigger SHALL record when the actuation originates from the access engine.

#### Scenario: Access source
- **WHEN** the request includes `source = 'access'` and `credentialId`
- **THEN** the response includes `requestId`, `relayIndex`, and `actuatedAt`
- **THEN** the access log can correlate the actuation

## MODIFIED Requirements

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

#### Scenario: Idempotent trigger
- **WHEN** the endpoint is called with a `requestId` already processed
- **THEN** the previous result is returned without forwarding a second command
