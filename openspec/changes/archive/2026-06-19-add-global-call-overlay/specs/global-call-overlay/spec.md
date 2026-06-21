## ADDED Requirements

### Requirement: Incoming call toast visible on any route
The dashboard SHALL display incoming call notifications as a global overlay regardless of which route the operator is viewing.

#### Scenario: Toast appears on operator panel
- **WHEN** an operator is viewing the operator panel (`/`) and a `call:incoming` event arrives
- **THEN** a toast notification appears with the building name, visitor info, and "Contestar" / "Ignorar" buttons

#### Scenario: Toast appears on admin panel
- **WHEN** an operator is viewing the admin panel (`/admin`) and a `call:incoming` event arrives
- **THEN** a toast notification appears identically to when on the operator panel

#### Scenario: Toast appears on guard panel
- **WHEN** a guard is viewing the guard panel and a `call:incoming` event arrives
- **THEN** a toast notification appears with accept/reject buttons

#### Scenario: Toast auto-dismisses on timeout
- **WHEN** a toast is shown and no action is taken within 30 seconds
- **THEN** the toast disappears automatically

### Requirement: Ringtone plays on incoming call from any route
The system SHALL play the selected ringtone when a call arrives, regardless of the current route.

#### Scenario: Ringtone plays on admin panel
- **WHEN** an operator is viewing the admin panel and a `call:incoming` event arrives
- **THEN** the ringtone starts playing in loop
- **THEN** the ringtone stops when the call is accepted, rejected, or taken by another operator

### Requirement: Accept call from any route
The operator SHALL be able to accept an incoming call from any route.

#### Scenario: Accept call from admin panel
- **WHEN** an operator clicks "Contestar" on the toast while on the admin panel
- **THEN** the WebRTC connection is established
- **THEN** the active call is set in SocketContext
- **THEN** a PiP video overlay appears showing the remote stream

### Requirement: Active call PiP overlay
When a call is active, the dashboard SHALL display a Picture-in-Picture overlay with the remote video, regardless of the current route.

#### Scenario: PiP appears on any route
- **WHEN** a call is active and the operator views any route (`/`, `/admin`, `/guard`)
- **THEN** a draggable PiP overlay is visible in the bottom-right corner showing the remote video
- **THEN** the PiP overlay floats above all other content

#### Scenario: PiP controls
- **WHEN** a PiP overlay is visible
- **THEN** it includes buttons for: Colgar (end call), Abrir Puerta, Mute/Unmute toggle
- **THEN** the buttons are functional from any route

#### Scenario: PiP minimize and restore
- **WHEN** the operator clicks a minimize button on the PiP
- **THEN** the PiP collapses to a small badge showing the building name
- **THEN** clicking the badge restores the full PiP

#### Scenario: PiP disappears on call end
- **WHEN** the call ends (via hangup or peer disconnect)
- **THEN** the PiP overlay is removed from the UI

### Requirement: Ringtone managed at layout level
The ringtone selection and playback SHALL be managed by the global overlay, not by OperatorPanel.

#### Scenario: Ringtone selector accessible from any route
- **WHEN** an operator views any route
- **THEN** the ringtone selector is accessible (e.g., in the TopBar or overlay controls)
