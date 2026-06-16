## ADDED Requirements

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
The server SHALL handle call termination from either peer and clean up state.

#### Scenario: Kiosk ends call before acceptance
- **WHEN** a kiosk emits `call:end` for a call not yet accepted
- **THEN** the timeout is cleared
- **THEN** the kiosk status resets to `idle` if it was `calling`
- **THEN** the server emits `call:ended { callId, reason: 'cancelled' }` back to the kiosk
- **THEN** the server broadcasts updated kiosk state

#### Scenario: Operator ends active call
- **WHEN** an operator emits `call:end` for an active call
- **THEN** the kiosk status resets to `idle`
- **THEN** the server emits `call:ended { callId }` to the kiosk
- **THEN** the call is removed from the calls Map
- **THEN** the server broadcasts updated kiosk state

#### Scenario: Kiosk ends active call
- **WHEN** a kiosk emits `call:end` for an active call
- **THEN** the kiosk status resets to `idle`
- **THEN** the server emits `call:ended { callId }` to the operator
- **THEN** the call is removed from the calls Map
- **THEN** the server broadcasts updated kiosk state

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
The server SHALL relay door open commands from operators to kiosks.

#### Scenario: Operator opens door
- **WHEN** a registered operator emits `door:open` with `{ callId, buildingId }`
- **THEN** the server emits `door:open { authorizedBy, timestamp }` to the kiosk for that buildingId
- **THEN** the server logs the door open event

#### Scenario: Non-operator opens door
- **WHEN** a socket not registered as operator emits `door:open`
- **THEN** the server emits `error` with message "No autorizado"

#### Scenario: Door open for unknown building
- **WHEN** an operator emits `door:open` with a `buildingId` that has no registered kiosk
- **THEN** no event is emitted (the kiosk is offline)

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
