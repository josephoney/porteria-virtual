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

### Requirement: Operator call history
The operator panel SHALL include a section showing the operator's recent call history.

#### Scenario: Recent calls displayed
- **WHEN** the operator panel loads
- **THEN** a collapsible "Mis llamadas" section is displayed
- **THEN** it shows up to 50 most recent calls where `operatorId` matches the operator's user ID
- **THEN** calls are fetched via `GET /api/calls?operatorId=<id>&pageSize=50`

#### Scenario: Call list shows relevant info
- **WHEN** the operator's call history is displayed
- **THEN** each row shows: kiosk name, start time (HH:MM format), and status (Atendida/Perdida)
- **THEN** calls are ordered by most recent first

#### Scenario: Empty history
- **WHEN** the operator has no call history
- **THEN** a message "Aún no has atendido llamadas" is displayed

#### Scenario: Section is collapsible
- **WHEN** the operator clicks the "Mis llamadas" header
- **THEN** the call list toggles between visible and hidden
- **THEN** the toggle state is preserved during the session (React state, not localStorage)

#### Scenario: History refreshes periodically
- **WHEN** the operator completes a call
- **THEN** the history refreshes to include the new call
- **THEN** a polling interval of 60 seconds keeps the list updated

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

### Requirement: Relay control buttons in VideoPanel
The dashboard operator SHALL see relay control buttons during an active call, with visual feedback for different relay modes.

#### Scenario: Relay buttons render on active call
- **WHEN** an active call is in progress
- **THEN** the VideoPanel renders control buttons for each relay output of the kiosk, excluding the one linked to the access point (already handled by "Abrir Puerta")
- **THEN** each button shows the relay label from the database

#### Scenario: Momentary relay button feedback
- **WHEN** the operator clicks a relay button configured as momentary
- **THEN** the button shows a "pulse" visual state for the duration of the relay activation
- **THEN** a `relay:trigger` event is emitted via Socket.io

#### Scenario: Latch relay button shows current state
- **WHEN** the VideoPanel renders a relay button configured as latch
- **THEN** the button displays the current ON/OFF state (green for ON, default for OFF)
- **THEN** clicking the button emits `relay:trigger` and the state updates when `relay:status` is received

#### Scenario: Relay buttons hidden when no active call
- **WHEN** there is no active call
- **THEN** no relay control buttons are rendered

### Requirement: Relay status subscription
The dashboard SHALL connect to the MQTT bridge Socket.io to receive real-time relay status updates.

#### Scenario: Subscribe to relay status
- **WHEN** the operator panel loads
- **THEN** a Socket.io connection is established to the MQTT bridge
- **THEN** the client listens for `relay:status` events

#### Scenario: Update button state on status event
- **WHEN** a `relay:status` event is received with `{ buildingId, relayIndex, state }`
- **THEN** the corresponding relay button in the UI updates its visual state to reflect ON or OFF

