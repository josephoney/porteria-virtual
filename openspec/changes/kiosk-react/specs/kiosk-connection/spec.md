## ADDED Requirements

### Requirement: Socket.io connection
The kiosk SHALL establish a WebSocket connection to the signaling server on app startup.

#### Scenario: Successful connection
- **WHEN** the kiosk app mounts
- **THEN** a Socket.io connection is established to the configured SERVER_URL
- **THEN** the connection overlay is hidden once connected

#### Scenario: Connection lost
- **WHEN** the WebSocket connection drops
- **THEN** a full-screen overlay with spinner is displayed
- **THEN** Socket.io automatically attempts reconnection

#### Scenario: Reconnection
- **WHEN** the connection is re-established
- **THEN** the overlay is hidden
- **THEN** the kiosk re-registers with the signaling server

### Requirement: Kiosk registration
The kiosk SHALL register with the signaling server using its building ID and name.

#### Scenario: Registration on connect
- **WHEN** the Socket.io connection is established
- **THEN** a `kiosk:register` event is emitted with `{ buildingId, buildingName }`
- **THEN** on `kiosk:registered` response, the status is set to connected

### Requirement: Event handling
The kiosk SHALL handle signaling events from the server.

#### Scenario: Incoming call accepted
- **WHEN** a `call:accepted` event is received with `{ callId, operatorName }`
- **THEN** the operator name badge is updated
- **THEN** the UI transitions to in-call screen

#### Scenario: Call ended by remote
- **WHEN** a `call:ended` event is received
- **THEN** the call is cleaned up and UI returns to idle

#### Scenario: Door opened
- **WHEN** a `door:open` event is received
- **THEN** the door flash overlay is triggered

### Requirement: Configuration
The kiosk SHALL use a configuration module for server URL, building ID, and ICE servers.

#### Scenario: Development mode
- **WHEN** the app is served from localhost or file:// protocol
- **THEN** the signaling server URL defaults to `http://localhost:3001`

#### Scenario: Production mode
- **WHEN** the app is served from a remote origin
- **THEN** the signaling server URL uses the same origin (nginx reverse proxy)
