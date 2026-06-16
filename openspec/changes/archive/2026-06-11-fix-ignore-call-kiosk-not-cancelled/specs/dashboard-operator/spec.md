## MODIFIED Requirements

### Requirement: Incoming call queue
The operator SHALL see incoming calls in a sidebar queue with toast notification.

#### Scenario: Incoming call received
- **WHEN** a `call:incoming` event is received
- **THEN** the call is added to the call queue in the sidebar
- **THEN** a toast notification slides in with building name and "Contestar" button

#### Scenario: Call answered
- **WHEN** the operator clicks "Contestar" on a call
- **THEN** a `call:accept` event is emitted
- **THEN** the call moves from pending to active
- **THEN** the video panel activates showing the kiosk video

#### Scenario: Call ignored from dashboard
- **WHEN** the operator clicks "Ignorar" on an incoming call toast
- **THEN** a `call:end` event is emitted with `{ callId, buildingId }`
- **THEN** the call is removed from the pending queue
- **THEN** the ring sound stops
- **THEN** the toast is hidden
