## MODIFIED Requirements

### Requirement: Call ended notification to operators
Modifies `signaling-server` call cancel handling.

#### Scenario: Kiosk cancels before acceptance — operators notified
- **WHEN** a kiosk emits `call:end` for a call not yet accepted (not in `state.calls`)
- **THEN** the server sends `call:ended { callId, reason: 'cancelled' }` to the kiosk
- **THEN** the server ALSO sends `call:ended { callId, reason: 'cancelled' }` to ALL operators via `io.to('operators')`

#### Scenario: Call times out — operators notified
- **WHEN** the 30-second timeout fires for an unanswered call
- **THEN** the server sends `call:ended { callId, reason: 'timeout' }` to the kiosk
- **THEN** the server ALSO sends `call:ended { callId, reason: 'timeout' }` to ALL operators

### Requirement: Dashboard removes cancelled calls from pending queue
The dashboard SocketContext SHALL listen for `call:ended` events and remove the corresponding call from the pending calls queue.

#### Scenario: Call cancelled — removed from pending
- **WHEN** a `call:ended` event is received with a `callId`
- **THEN** the call is removed from `pendingCalls`
- **THEN** a log entry is added: "END: Llamada cancelada — {buildingName}" or "END: Llamada expirada — {buildingName}"

### Requirement: Toast cleared when pending queue empties
The operator panel toast SHALL be cleared when the pending calls queue becomes empty.

#### Scenario: All calls answered or cancelled
- **WHEN** `pendingCalls.size` transitions to 0
- **THEN** `toastCall` is set to `null`
- **THEN** the incoming call toast is no longer visible
