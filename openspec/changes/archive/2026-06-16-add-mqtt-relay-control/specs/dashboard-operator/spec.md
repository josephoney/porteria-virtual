## ADDED Requirements

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
