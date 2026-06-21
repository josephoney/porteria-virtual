## ADDED Requirements

### Requirement: Internal event creation endpoint
The API server SHALL expose `POST /api/internal/events` for other services to insert events.

#### Scenario: Create event with valid API key
- **WHEN** a POST request is made to `/api/internal/events` with a valid `X-Internal-Key` header and body `{ eventType, organizationId, actorId?, actorRole?, locationId?, accessPointId?, metadata? }`
- **THEN** the event is inserted into the events table and 201 is returned

#### Scenario: Reject without API key
- **WHEN** a POST request is made without `X-Internal-Key`
- **THEN** the response has status 401

#### Scenario: Reject missing eventType
- **WHEN** a POST request is made without `eventType` in the body
- **THEN** the response has status 400 with validation details

### Requirement: Door open event
The system SHALL record a `door.open` event when an operator opens a door.

#### Scenario: Door open logged
- **WHEN** an operator triggers `door:open` in the signaling server
- **THEN** a `door.open` event is persisted with `actorId` set to the operator's ID, `actorRole` set to `'operator'`, and `accessPointId` set to the door's access point

### Requirement: User login event
The system SHALL record a `user.login` event on successful authentication.

#### Scenario: Login event recorded
- **WHEN** a user successfully logs in via `POST /api/auth/login`
- **THEN** a `user.login` event is persisted with `actorId` set to the user's ID, `actorRole` set to their role, and `organizationId` from the user

### Requirement: User logout event
The system SHALL record a `user.logout` event on logout.

#### Scenario: Logout event recorded
- **WHEN** a user logs out via `POST /api/auth/logout`
- **THEN** a `user.logout` event is persisted with `actorId` from the revoked refresh token's user

### Requirement: Kiosk online event
The system SHALL record a `kiosk.online` event when a kiosk connects to the signaling server.

#### Scenario: Kiosk online logged
- **WHEN** a kiosk successfully registers via `kiosk:register`
- **THEN** a `kiosk.online` event is persisted with `accessPointId` and `locationId` resolved from the kiosk

### Requirement: Kiosk offline event
The system SHALL record a `kiosk.offline` event when a kiosk disconnects.

#### Scenario: Kiosk offline logged
- **WHEN** a kiosk socket disconnects from the signaling server
- **THEN** a `kiosk.offline` event is persisted with the kiosk's `accessPointId`

### Requirement: User management events
The system SHALL record events for user creation and updates.

#### Scenario: User created event
- **WHEN** an admin creates a user via `POST /api/users`
- **THEN** a `user.created` event is persisted with `actorId` set to the admin's ID and metadata containing the new user's role

#### Scenario: User updated event
- **WHEN** an admin updates a user's role or active status via `PATCH /api/users/:id`
- **THEN** a `user.updated` event is persisted with metadata containing the changed fields
