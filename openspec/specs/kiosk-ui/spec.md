## Purpose

Kiosk touch UI states and screens for idle, calling, and in-call flows.

## Requirements

### Requirement: Idle screen
The kiosk SHALL display an idle screen with building name, address, current time, and a call button when not in a call.

#### Scenario: Kiosk starts in idle state
- **WHEN** the kiosk app loads and successfully registers with the signaling server
- **THEN** the idle screen is displayed with the building name, address, and current time
- **THEN** a round "LLAMAR" button is centered on screen with a pulsing ring animation

#### Scenario: Clock updates every second
- **WHEN** the idle screen is visible
- **THEN** the time display updates every second showing the current time in HH:MM format

### Requirement: Calling screen
The kiosk SHALL display a calling screen with a connecting animation and cancel button when a call is in progress.

#### Scenario: Transition to calling
- **WHEN** the user presses the call button
- **THEN** the UI transitions from idle to calling screen
- **THEN** a pulsing phone icon animation is displayed
- **THEN** a "CANCELAR" button is available

#### Scenario: Cancel call
- **WHEN** the user presses cancel during calling
- **THEN** the call is ended via Socket.io
- **THEN** the UI returns to idle screen

### Requirement: In-call screen
The kiosk SHALL display the in-call screen with remote video, local video PiP, call timer, and controls during an active call.

#### Scenario: Call accepted
- **WHEN** an operator accepts the call
- **THEN** the UI transitions to in-call screen
- **THEN** the remote video stream is displayed full-screen
- **THEN** the local video is shown as picture-in-picture in the bottom right
- **THEN** the operator name badge is displayed
- **THEN** a call timer starts counting from 00:00

#### Scenario: Call controls visible
- **WHEN** the in-call screen is active
- **THEN** a mute/unmute microphone button is displayed
- **THEN** a red hang-up button is displayed

#### Scenario: Mute toggle
- **WHEN** the user presses the mute button
- **THEN** the local audio track is disabled
- **THEN** the mute button shows reduced opacity to indicate muted state
- **WHEN** the user presses it again
- **THEN** the audio is re-enabled

### Requirement: Door open flash
The kiosk SHALL display a full-screen "PUERTA ABIERTA" flash overlay when the door is opened remotely.

#### Scenario: Door opened remotely
- **WHEN** a `door:open` event is received from the signaling server
- **THEN** a green overlay with "PUERTA ABIERTA" text is displayed for 2.5 seconds
- **THEN** the overlay fades out automatically

### Requirement: Status indicator
The kiosk SHALL show a connection status dot in the top bar.

#### Scenario: Connected state
- **WHEN** the Socket.io connection is established and the kiosk is registered
- **THEN** the status dot is green with a glow effect
- **THEN** the text shows "CONECTADO"

#### Scenario: Disconnected state
- **WHEN** the Socket.io connection is lost
- **THEN** a full-screen overlay with a spinner and "Conectando al servidor…" is displayed
- **THEN** the status dot turns gray and text shows "DESCONECTADO"

### Requirement: Visual design consistency
The kiosk SHALL maintain the same dark theme visual design as the legacy kiosk.

#### Scenario: Dark theme
- **WHEN** the kiosk app is rendered
- **THEN** the background is `#0a0c0f` with a CSS grid pattern and noise grain texture
- **THEN** the accent color is `#00e5a0` (green)
- **THEN** the font family is "Bebas Neue" for display text and "DM Sans" for body text
- **THEN** the call button has animated concentric rings
