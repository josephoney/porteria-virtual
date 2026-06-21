# Signaling Server

## Purpose

Socket.io signaling server that handles kiosk and operator WebSocket connections, manages call lifecycle (request, accept, end), relays WebRTC signaling (offers, answers, ICE candidates), handles door control and visitor identification events.
## Requirements
### Requirement: Server startup and health check
The signaling server SHALL start on the configured port and expose a health check endpoint with metrics.

#### Scenario: Server starts
- **WHEN** the server process starts with a valid PORT environment variable
- **THEN** the Fastify + Socket.io server listens on the configured port
- **THEN** a log entry confirms the server is running

#### Scenario: Health check responds with metrics
- **WHEN** a GET request is made to `/health`
- **THEN** the response has status 200 with `{ status: 'ok', service: 'signaling', kiosks: N, operators: N, activeCalls: N, uptime, timestamp }`

#### Scenario: CORS headers present
- **WHEN** an OPTIONS preflight request is made
- **THEN** the response includes appropriate CORS headers

### Requirement: Kiosk registration
The server SHALL register kiosks by buildingId via Socket.io and broadcast state updates to operators.

#### Scenario: Kiosk registers successfully
- **WHEN** a socket emits `kiosk:register` with `{ buildingId, buildingName }`
- **THEN** the kiosk is stored in the kiosks Map with `socketId`, `buildingName`, `status: 'idle'`, `registeredAt`
- **THEN** the socket joins room `building:<buildingId>`
- **THEN** the server emits `kiosk:registered` with `{ buildingId, serverTime }` to the socket
- **THEN** the server broadcasts updated kiosk state to all operators

#### Scenario: Kiosk registers without buildingId
- **WHEN** a socket emits `kiosk:register` without `buildingId`
- **THEN** the server emits `error` with message "buildingId requerido"

#### Scenario: Kiosk re-registers (same buildingId)
- **WHEN** a kiosk with an already registered `buildingId` registers again
- **THEN** the existing entry is overwritten with the new socketId and data

### Requirement: Operator registration
The server SHALL register operators via Socket.io and send current kiosk state.

#### Scenario: Operator registers successfully
- **WHEN** a socket emits `operator:register` with `{ operatorId, name }`
- **THEN** the operator is stored in the operators Map
- **THEN** the socket joins room `operators`
- **THEN** the server emits `operator:registered` with `{ kiosks: [...], serverTime }` containing all registered kiosks

#### Scenario: Operator registers without operatorId
- **WHEN** a socket emits `operator:register` without `operatorId`
- **THEN** the server emits `error` with message "operatorId requerido"

### Requirement: Call request lifecycle
The server SHALL manage the full call lifecycle from request to end, including 30-second timeout for unanswered calls.

#### Scenario: Kiosk initiates a call
- **WHEN** a registered kiosk emits `call:request`
- **THEN** the kiosk status changes from `idle` to `calling`
- **THEN** a `callId` is generated
- **THEN** the server emits `call:waiting { callId }` to the kiosk
- **THEN** the server emits `call:incoming { callId, buildingId, buildingName, visitor?, timestamp }` to all operators
- **THEN** a 30-second timeout is started for auto-cancellation

#### Scenario: Call request from non-kiosk socket
- **WHEN** a socket not registered as kiosk emits `call:request`
- **THEN** the server emits `error` with message "No estás registrado como kiosk"

#### Scenario: Operator accepts a call
- **WHEN** a registered operator emits `call:accept` with `{ callId, buildingId }`
- **THEN** the kiosk status changes to `in-call`
- **THEN** the call is stored in the calls Map with kiosk socket, operator socket, buildingId, startedAt
- **THEN** the 30-second timeout is cleared
- **THEN** the server emits `call:accepted { callId, operatorName }` to the kiosk
- **THEN** the server emits `call:taken { callId, buildingId }` to other operators
- **THEN** the server emits `call:ready { callId, buildingId, buildingName }` to the accepting operator
- **THEN** the server broadcasts updated kiosk state to all operators

#### Scenario: Operator accepts from unknown operator
- **WHEN** a socket not registered as operator emits `call:accept`
- **THEN** the server emits `error` with message "No eres un operador registrado"

#### Scenario: Call times out after 30 seconds
- **WHEN** a call is not accepted within 30 seconds of `call:request`
- **THEN** the kiosk status resets to `idle`
- **THEN** the server emits `call:ended { callId, reason: 'timeout' }` to the kiosk
- **THEN** the server broadcasts updated kiosk state to operators

#### Scenario: Call accepted before timeout
- **WHEN** `call:accept` is received before the 30-second timeout
- **THEN** the timeout is cleared and does not fire

### Requirement: Call end handling
The signaling server SHALL handle `call:end` events from any peer and forward `call:ended` to the counterpart.

#### Scenario: Kiosk cancels before operator accepts
- **WHEN** a kiosk emits `call:end` and the call is not in `state.calls`
- **THEN** the kiosk status is reset to `idle`
- **THEN** `call:ended` is emitted to the kiosk and to all operators

#### Scenario: Operator cancels before accepting (with buildingId)
- **WHEN** an operator emits `call:end` with `{ callId, buildingId }` and the call is not in `state.calls`
- **THEN** the kiosk identified by `buildingId` has its status reset to `idle`
- **THEN** `call:ended` with reason `cancelled` is emitted to that kiosk
- **THEN** `call:ended` is emitted to all operators

#### Scenario: Either peer cancels during active call
- **WHEN** either peer emits `call:end` and the call exists in `state.calls`
- **THEN** `call:ended` is forwarded to the other peer
- **THEN** the call is removed from `state.calls`
- **THEN** the kiosk status is reset to `idle`

#### Scenario: Operator cancels without buildingId and call not assigned
- **WHEN** an operator emits `call:end` without `buildingId` and the call is not in `state.calls`
- **THEN** `call:ended` is emitted to the operator and to all operators
- **THEN** no kiosk is notified (backward compatible behavior)

### Requirement: WebRTC signaling relay
The server SHALL relay WebRTC offer, answer, and ICE candidates between peers in an active call.

#### Scenario: Offer relayed from kiosk to operator
- **WHEN** a socket in an active call emits `webrtc:offer` with `{ callId, offer }`
- **THEN** the offer is relayed to the other peer in the call

#### Scenario: Answer relayed from operator to kiosk
- **WHEN** a socket in an active call emits `webrtc:answer` with `{ callId, answer }`
- **THEN** the answer is relayed to the other peer in the call

#### Scenario: ICE candidate relayed
- **WHEN** a socket in an active call emits `webrtc:ice-candidate` with `{ callId, candidate }`
- **THEN** the candidate is relayed to the other peer in the call

#### Scenario: WebRTC event for unknown call
- **WHEN** a socket emits a WebRTC event for a callId not in the calls Map
- **THEN** the event is silently dropped (no crash, no error broadcast)

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

#### Scenario: Non-operator opens door
- **WHEN** a socket not registered as operator emits `door:open`
- **THEN** the server emits `error` with message "No autorizado"

#### Scenario: Door open for unknown building
- **WHEN** an operator emits `door:open` with a `buildingId` that has no registered kiosk
- **THEN** no event is emitted (the kiosk is offline)

### Requirement: Relay trigger from dashboard
The signaling server SHALL handle `relay:trigger` events from dashboard operators to activate arbitrary relays.

#### Scenario: Operator triggers a relay
- **WHEN** a dashboard emits `relay:trigger` with `{ buildingId, relayIndex }`
- **THEN** the signaling server validates the operator is registered
- **THEN** a fire-and-forget HTTP call is made to `POST /api/internal/relays/trigger` with the kiosk and relay details

#### Scenario: Unauthorized relay trigger
- **WHEN** a non-operator socket emits `relay:trigger`
- **THEN** the event is ignored and an error is emitted back

### Requirement: Visitor identification relay
The server SHALL relay visitor identification events from kiosks to operators.

#### Scenario: Visitor identified at kiosk
- **WHEN** a kiosk emits `visitor:identified` with `{ buildingId, visitor }`
- **THEN** the kiosk's `lastVisitor` is updated
- **THEN** the server emits `visitor:identified { buildingId, buildingName, visitor, timestamp }` to all operators

### Requirement: Disconnect cleanup
The server SHALL clean up state when a kiosk or operator disconnects, including active calls and pending timeouts.

#### Scenario: Kiosk disconnects
- **WHEN** a registered kiosk disconnects
- **THEN** all pending call timeouts for that kiosk are cleared
- **THEN** the kiosk is removed from the kiosks Map
- **THEN** all active calls involving that kiosk are ended
- **THEN** the other peer in each ended call receives `call:ended { callId, reason: 'peer_disconnected' }`
- **THEN** the server broadcasts updated kiosk state

#### Scenario: Operator disconnects
- **WHEN** a registered operator disconnects
- **THEN** the operator is removed from the operators Map
- **THEN** all active calls involving that operator are ended
- **THEN** the kiosk in each ended call receives `call:ended { callId, reason: 'peer_disconnected' }`
- **THEN** the kiosk status resets to `idle`
- **THEN** the server broadcasts updated kiosk state

### Requirement: Call persistence on call:request
The signaling server SHALL create a call record in the database when a kiosk initiates a call.

#### Scenario: Call request triggers persistence
- **WHEN** the signaling server receives `call:request` from a kiosk
- **THEN** after emitting `call:incoming` and `call:waiting`, a fire-and-forget POST is made to `{API_BASE_URL}/api/internal/calls`
- **THEN** the POST body includes `{ callId, buildingId, visitor? }`
- **THEN** the POST includes `X-Internal-Key` header
- **THEN** if the POST fails, the error is logged but the call proceeds normally

#### Scenario: Persistence does not block call flow
- **WHEN** the internal API is slow or unavailable
- **THEN** the `call:incoming` event is still emitted to operators immediately
- **THEN** the call lifecycle proceeds without waiting for the HTTP response

### Requirement: Call persistence on call:accept
The signaling server SHALL update the call record when an operator accepts a call.

#### Scenario: Accept triggers status update
- **WHEN** the signaling server receives `call:accept` from an operator
- **THEN** after processing the accept (setting status, clearing timeout, emitting events), a fire-and-forget PATCH is made to `{API_BASE_URL}/api/internal/calls/{callId}`
- **THEN** the PATCH body includes `{ status: "active", operatorId }`
- **THEN** if the PATCH fails, the error is logged

### Requirement: Call persistence on call:end and timeout
The signaling server SHALL update the call record when a call ends (normal end, cancel, timeout, or peer disconnect).

#### Scenario: Normal end (call was accepted)
- **WHEN** a `call:end` event is received for an active call (has entry in `state.calls`)
- **THEN** after processing the end, a fire-and-forget PATCH is made with `{ status: "ended", endedAt, duration, eventType: "call.ended" }`
- **THEN** `duration` is calculated as `Math.round((endedAt - call.startedAt) / 1000)` in seconds

#### Scenario: Cancel before accept
- **WHEN** a `call:end` event is received for a call that was never accepted (no entry in `state.calls`)
- **THEN** a fire-and-forget PATCH is made with `{ status: "missed", endedAt, eventType: "call.missed" }`
- **THEN** the `call:ended` event with `reason: 'cancelled'` is still emitted to operators

#### Scenario: Timeout
- **WHEN** the 30-second timeout fires for an unanswered call
- **THEN** a fire-and-forget PATCH is made with `{ status: "missed", endedAt, eventType: "call.missed" }`

#### Scenario: Peer disconnect
- **WHEN** a socket disconnects during an active call
- **THEN** a fire-and-forget PATCH is made with `{ status: "ended", endedAt, duration, eventType: "call.ended" }`

### Requirement: Structured logging
The server SHALL log all significant events with structured context for traceability.

#### Scenario: Connection logged
- **WHEN** a socket connects
- **THEN** the log entry includes `socketId` and event type "connection"

#### Scenario: Kiosk registration logged
- **WHEN** a kiosk registers successfully
- **THEN** the log entry includes `buildingId`, `buildingName`, and event type

#### Scenario: Call lifecycle logged
- **WHEN** a call is requested, accepted, or ended
- **THEN** the log entry includes `callId`, participants, and event type

#### Scenario: Disconnection logged with role
- **WHEN** a socket disconnects
- **THEN** the log entry includes `socketId`, `role` (kiosk/operator/unknown), and event type

