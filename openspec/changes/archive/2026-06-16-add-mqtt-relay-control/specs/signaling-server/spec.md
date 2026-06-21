## MODIFIED Requirements

### Requirement: Door control
The operator SHALL be able to open doors remotely during an active call.

#### Scenario: Door opened
- **WHEN** the operator clicks "Abrir" during an active call
- **THEN** a `door:open` event is emitted with `{ callId, buildingId }`
- **THEN** an event is added to the log: "DOOR: Puerta abierta — {buildingName}"

#### Scenario: Door open triggers physical relay
- **WHEN** a `door:open` event is processed
- **THEN** the signaling server looks up the relay output linked to the kiosk's access point
- **THEN** a fire-and-forget HTTP call is made to `POST /api/internal/relays/trigger` with the relay configuration
- **THEN** failure to trigger the relay does not block the `door:open` event flow (logged as warning)

## ADDED Requirements

### Requirement: Relay trigger from dashboard
The signaling server SHALL handle `relay:trigger` events from dashboard operators to activate arbitrary relays.

#### Scenario: Operator triggers a relay
- **WHEN** a dashboard emits `relay:trigger` with `{ buildingId, relayIndex }`
- **THEN** the signaling server validates the operator is registered
- **THEN** a fire-and-forget HTTP call is made to `POST /api/internal/relays/trigger` with the kiosk and relay details

#### Scenario: Unauthorized relay trigger
- **WHEN** a non-operator socket emits `relay:trigger`
- **THEN** the event is ignored and an error is emitted back
