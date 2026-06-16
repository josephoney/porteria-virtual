# Dashboard Operator Panel

## Purpose

Provides the operator panel within the dashboard: real-time WebRTC video calls with kiosks, incoming call queue with toast notifications, kiosk status monitoring, door control, and event logging.
## Requirements
### Requirement: Operator registration
The operator SHALL register with the signaling server via Socket.io on connect.

#### Scenario: Operator registered
- **WHEN** the Socket.io connection is established
- **THEN** an `operator:register` event is emitted with `{ operatorId, name }`
- **THEN** on `operator:registered`, the kiosk list is received and rendered

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

### Requirement: WebRTC receiver
The operator SHALL receive WebRTC offers and send answers to establish video calls.

#### Scenario: Receive offer and send answer
- **WHEN** a `webrtc:offer` event is received
- **THEN** an RTCPeerConnection is created and remote description is set
- **THEN** an SDP answer is created and sent via `webrtc:answer`

#### Scenario: Remote video stream
- **WHEN** the remote peer's media tracks arrive via ontrack
- **THEN** the remote video element displays the kiosk's video

### Requirement: Door control
The operator SHALL be able to open doors remotely during an active call.

#### Scenario: Door opened
- **WHEN** the operator clicks "Abrir" during an active call
- **THEN** a `door:open` event is emitted with `{ callId, buildingId }`
- **THEN** an event is added to the log: "DOOR: Puerta abierta — {buildingName}"

### Requirement: Kiosk status list
The operator SHALL see all registered kiosks with their status in the sidebar.

#### Scenario: Kiosk list updates
- **WHEN** a `kiosks:update` event is received
- **THEN** the kiosk list is re-rendered with status dots (green=idle, amber=calling, blue=in-call)

### Requirement: Event log
The operator SHALL see a real-time event log of all activity.

#### Scenario: Event logged
- **WHEN** any system event occurs (call, door, system)
- **THEN** the event is prepended to the log panel with timestamp, type badge, and message

#### Scenario: Log types
- **WHEN** an event type is CALL
- **THEN** the badge is amber
- **WHEN** an event type is DOOR
- **THEN** the badge is green
- **WHEN** an event type is SYS
- **THEN** the badge is blue

### Requirement: Call controls
The operator SHALL have video call controls: mute microphone, end call.

#### Scenario: End call
- **WHEN** the operator clicks the hang-up button
- **THEN** a `call:end` event is emitted
- **THEN** the peer connection is cleaned up
- **THEN** the video panel hides and shows empty state

#### Scenario: Mute microphone
- **WHEN** the operator clicks the mute button
- **THEN** the local audio track is toggled
- **THEN** the button opacity changes to indicate mute state

### Requirement: Ringtone selector UI
The operator panel header SHALL include a ringtone selector dropdown that allows choosing and previewing ringtones.

#### Scenario: Selector renders with current ringtone
- **WHEN** the operator panel loads
- **THEN** a `<select>` dropdown is rendered in the panel main header
- **THEN** the currently selected ringtone is shown as the selected option

#### Scenario: Changing ringtone saves and previews
- **WHEN** the operator selects a different ringtone from the dropdown
- **THEN** the selection is persisted to localStorage
- **THEN** a preview of the selected ringtone plays once

#### Scenario: Selector hidden for guard role
- **WHEN** a user with role 'guard' views the dashboard
- **THEN** the ringtone selector is not rendered

