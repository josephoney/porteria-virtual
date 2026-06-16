## ADDED Requirements

### Requirement: onCallEnded validates callId
The kiosk's `call:ended` handler SHALL receive and validate the `callId` parameter, ignoring events that don't match the current call.

#### Scenario: Matching callId
- **WHEN** a `call:ended` event is received with callId that matches `callIdRef.current`
- **THEN** the handler executes cleanup: reset callIdRef, close peer connection, reset screen to idle

#### Scenario: Stale callId
- **WHEN** a `call:ended` event is received with callId that does NOT match `callIdRef.current` (user started a new call)
- **THEN** the handler returns early without resetting anything

#### Scenario: callIdRef is null
- **WHEN** a `call:ended` event is received and `callIdRef.current` is null (already reset locally)
- **THEN** the handler executes cleanup normally (redundant but harmless)

### Requirement: doCancel resets locally and emits to server
The kiosk SHALL reset the screen to idle immediately when the user cancels, while also emitting `call:end` to the server.

#### Scenario: Cancel during calling
- **WHEN** the user presses the cancel button on the calling screen
- **THEN** the kiosk emits `call:end` with the current callId
- **THEN** the kiosk resets locally: callIdRef=null, cleanupPeer, screen=idle
- **THEN** the user sees the idle screen immediately

#### Scenario: Cancel then immediately call again
- **WHEN** the user cancels and quickly presses call again before the server's `call:ended` arrives
- **THEN** the new call proceeds normally (screen transitions to calling)
- **WHEN** the stale `call:ended` arrives with the old callId
- **THEN** it is ignored because `callIdRef.current` (new callId) doesn't match

### Requirement: doHangUp follows same pattern
The kiosk SHALL use the same pattern for hang up as cancel: local reset + emit to server.

#### Scenario: Hang up during active call
- **WHEN** the user presses the hang-up button during an active call
- **THEN** the kiosk emits `call:end` with the current callId
- **THEN** the kiosk resets locally: callIdRef=null, cleanupPeer, screen=idle
