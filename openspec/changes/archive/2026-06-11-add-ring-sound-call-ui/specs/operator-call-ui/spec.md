## ADDED Requirements

### Requirement: Incoming call ring sound
The dashboard SHALL play an audible ring tone when a new call arrives and stop it when the call is handled.

#### Scenario: Ring starts on incoming call
- **WHEN** a `call:incoming` event is received
- **THEN** a ring audio file starts playing in a loop
- **THEN** the audio volume is configurable (default 50%)

#### Scenario: Ring stops on call accepted
- **WHEN** the operator clicks "Contestar" on a call
- **THEN** the ring audio stops immediately

#### Scenario: Ring stops on call taken by another operator
- **WHEN** a `call:taken` event is received
- **THEN** the ring audio stops

#### Scenario: Ring stops on call cancelled or timed out
- **WHEN** a `call:ended` event is received
- **THEN** the ring audio stops

### Requirement: Call display mode toggle
The operator SHALL be able to switch between inline and overlay video display modes.

#### Scenario: Default inline mode
- **WHEN** the operator panel loads
- **THEN** the video call renders in the center panel (current behavior)
- **THEN** a toggle switch shows "Modo superpuesto"

#### Scenario: Overlay mode activated
- **WHEN** the operator enables the overlay toggle
- **THEN** the active call video renders as a fixed overlay on top of the dashboard
- **THEN** the dashboard content (logs, kiosk list) remains visible underneath

#### Scenario: Minimize to PiP
- **WHEN** the operator clicks "Minimizar" on the overlay
- **THEN** the video shrinks to a small picture-in-picture in the bottom-right corner
- **THEN** the dashboard is fully interactive

#### Scenario: Restore from PiP
- **WHEN** the operator clicks the PiP window
- **THEN** the video expands back to full overlay

#### Scenario: No active call — toggle has no effect
- **WHEN** no call is active
- **THEN** the toggle switch is disabled or hidden
- **THEN** the empty state "Sin llamada activa" is shown

### Requirement: Audio track verification logs
The kiosk and dashboard WebRTC hooks SHALL log audio track details during call setup.

#### Scenario: Kiosk logs audio tracks
- **WHEN** the kiosk obtains local media stream
- **THEN** the console logs the count and labels of audio tracks separately from video tracks

#### Scenario: Dashboard logs audio tracks
- **WHEN** the dashboard obtains local media stream
- **THEN** the console logs the count and labels of audio tracks separately from video tracks

#### Scenario: Remote audio track received
- **WHEN** either peer receives a remote media stream
- **THEN** the console logs whether the stream contains audio tracks and their state
