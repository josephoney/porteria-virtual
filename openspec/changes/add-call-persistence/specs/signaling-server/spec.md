## ADDED Requirements

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
