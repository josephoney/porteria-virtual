# signaling-authorization Specification

## Purpose
TBD - created by archiving change fix-critical-security-and-tenant. Update Purpose after archive.
## Requirements
### Requirement: Socket authentication

The signaling server SHALL authenticate every operator and kiosk socket.

#### Scenario: Valid operator JWT
- **WHEN** a socket connects with a valid access token
- **THEN** the server derives `userId`, `role`, `orgId`, `communityId`, and `membershipId`
- **THEN** the socket is allowed to register as an operator only if its role is
  `operator`, `guard`, `community_admin`, or `org_admin`

#### Scenario: Missing or invalid token
- **WHEN** a socket connects without a token or with an invalid token
- **THEN** the server disconnects it with an authentication error

#### Scenario: Resident token
- **WHEN** a resident connects
- **THEN** the server does not allow operator registration
- **THEN** the socket cannot receive kiosk or call events

### Requirement: Community rooms

Signaling events SHALL be scoped to the operator's community.

#### Scenario: Community-scoped operator joins community
- **WHEN** an `operator`, `guard`, or `community_admin` registers
- **THEN** it joins `community:{communityId}`
- **THEN** it receives only kiosks and calls of that community

#### Scenario: Org admin joins organization
- **WHEN** an `org_admin` registers
- **THEN** it joins `org:{orgId}`
- **THEN** it receives kiosks and calls of the organization

#### Scenario: Incoming call isolation
- **WHEN** a kiosk in community A requests a call
- **THEN** only operators of community A (or the org admin of its organization) receive
  `call:incoming`

#### Scenario: Kiosk update isolation
- **WHEN** a kiosk state changes
- **THEN** only operators of its community (or the org admin of its organization) receive
  `kiosks:update`

### Requirement: Actuation authorization

Door and relay actions SHALL require an authorized operator in the same community.

#### Scenario: Authorized door open
- **WHEN** an operator of the kiosk's community opens the door
- **THEN** the server emits `door:open` and triggers the relay

#### Scenario: Cross-community door open
- **WHEN** an operator from another community sends `door:open` for a kiosk they do not
  own
- **THEN** the server rejects the action and records a security event

#### Scenario: Resident door open
- **WHEN** a resident socket sends `door:open`
- **THEN** the server rejects the action

#### Scenario: Relay trigger
- **WHEN** an operator sends `relay:trigger`
- **THEN** the same community and role checks apply

### Requirement: Kiosk authentication

Kiosks SHALL authenticate with a device credential.

#### Scenario: Provisioned kiosk
- **WHEN** a kiosk connects with its device token
- **THEN** the server resolves its `kioskId`, `communityId`, and `organizationId`
- **THEN** it joins `kiosk:{kioskId}`

#### Scenario: Spoofed payload
- **WHEN** a client sends a `communityId` or `kioskId` different from its token
- **THEN** the server ignores the payload and uses the token context

#### Scenario: Unprovisioned kiosk
- **WHEN** a kiosk connects without a valid device token
- **THEN** the server rejects the connection

