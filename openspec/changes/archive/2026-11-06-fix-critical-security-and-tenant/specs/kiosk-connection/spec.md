## MODIFIED Requirements

### Requirement: Socket.io connection
The kiosk SHALL establish an authenticated WebSocket connection to the signaling server
on app startup.

#### Scenario: Successful connection
- **WHEN** the kiosk app mounts
- **THEN** a Socket.io connection is established to the configured server URL with
  `auth: { deviceToken }`
- **THEN** the connection overlay is hidden once connected

#### Scenario: Missing or invalid device token
- **WHEN** the kiosk connects without a valid device token
- **THEN** the signaling server rejects the connection
- **THEN** the kiosk shows a configuration error instead of the idle screen

#### Scenario: Connection lost
- **WHEN** the WebSocket connection drops
- **THEN** a full-screen overlay with spinner is displayed
- **THEN** Socket.io automatically attempts reconnection

#### Scenario: Reconnection
- **WHEN** the connection is re-established
- **THEN** the overlay is hidden
- **THEN** the kiosk re-registers with the signaling server

### Requirement: Kiosk registration
The kiosk SHALL register using the identity derived from its device token.

#### Scenario: Registration on connect
- **WHEN** the Socket.io connection is established
- **THEN** a `kiosk:register` event is emitted with `{ name }`
- **THEN** the server derives `kioskId`, `communityId`, and `organizationId` from the
  device token
- **THEN** on `kiosk:registered` response, the status is set to connected

#### Scenario: Spoofed kiosk identity
- **WHEN** a `kiosk:register` payload includes a `communityId` or `kioskId`
- **THEN** the server ignores those fields and uses the token context

### Requirement: Configuration
The kiosk SHALL use a configuration module for server URL, device token, and ICE
servers.

#### Scenario: Development mode
- **WHEN** the app is served from localhost or file:// protocol
- **THEN** the signaling server URL defaults to `http://localhost:3001`

#### Scenario: Production mode
- **WHEN** the app is served from a remote origin
- **THEN** the signaling server URL uses the same origin (nginx reverse proxy)

#### Scenario: Device token configured
- **WHEN** `KIOSK_TOKEN` is set for the device
- **THEN** the kiosk sends it in the signaling handshake
- **WHEN** `KIOSK_TOKEN` is missing
- **THEN** the kiosk reports a configuration error
