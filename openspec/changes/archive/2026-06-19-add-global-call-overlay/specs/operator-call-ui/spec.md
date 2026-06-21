## MODIFIED Requirements

### Requirement: Incoming call ring sound
The global IncomingCallOverlay SHALL play the operator's selected ringtone when a new call arrives, regardless of the current route.

#### Scenario: Ring starts on incoming call with selected ringtone
- **WHEN** a `call:incoming` event is received
- **THEN** the ringtone selected by the operator starts playing in a loop
- **THEN** the ringtone is the one identified by `localStorage.getItem('ringtone')` or 'classic' if not set
- **THEN** this behavior works from any route (`/`, `/admin`, `/guard`)

#### Scenario: Ring stops on call accepted
- **WHEN** the operator clicks "Contestar" on the global toast
- **THEN** the ring audio stops immediately

#### Scenario: Ring stops on call taken by another operator
- **WHEN** a `call:taken` event is received
- **THEN** the ring audio stops

#### Scenario: Ring stops on call cancelled or timed out
- **WHEN** a `call:ended` event is received
- **THEN** the ring audio stops

#### Scenario: Ringtone changed while ringing
- **WHEN** the operator changes the ringtone selection while a ring is actively playing
- **THEN** the current ring continues with the previously selected ringtone
- **THEN** the next incoming call uses the newly selected ringtone

### Requirement: Call display mode toggle
The operator SHALL be able to switch between inline and overlay video display modes. On routes other than the operator panel, the call SHALL always display as PiP overlay.

#### Scenario: Default inline mode on operator panel
- **WHEN** the operator is on the operator panel (`/`) and a call is active
- **THEN** the video renders inline in the center panel
- **THEN** a toggle switch shows "Modo superpuesto"

#### Scenario: Overlay mode activated on operator panel
- **WHEN** the operator enables the overlay toggle on the operator panel
- **THEN** the active call video renders as a fixed overlay on top of the dashboard
- **THEN** the dashboard content remains visible underneath

#### Scenario: Auto-overlay on admin or guard panel
- **WHEN** the operator navigates to `/admin` or `/guard` while a call is active
- **THEN** the call automatically switches to PiP overlay mode
- **THEN** the inline video slot in OperatorPanel is empty

#### Scenario: Restore inline on return to operator panel
- **WHEN** the operator navigates back to `/` while in overlay mode
- **THEN** the operator can toggle back to inline mode
- **THEN** the PiP overlay is replaced by the inline video

#### Scenario: Minimize to PiP
- **WHEN** the operator clicks "Minimizar" on the overlay
- **THEN** the video shrinks to a small picture-in-picture in the bottom-right corner

#### Scenario: No active call — toggle has no effect
- **WHEN** no call is active
- **THEN** the toggle switch is disabled or hidden
- **THEN** the empty state "Sin llamada activa" is shown
