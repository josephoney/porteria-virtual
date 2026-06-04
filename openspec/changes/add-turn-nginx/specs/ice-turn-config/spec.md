## ADDED Requirements

### Requirement: TURN ICE servers in kiosk
The kiosk app SHALL include the local TURN server in its ICE servers configuration.

#### Scenario: TURN in development mode
- **WHEN** the kiosk is running in development mode (localhost or private IP)
- **THEN** ICE_SERVERS includes the TURN server at `turn:<hostname>:3478` with username and credential

#### Scenario: TURN in production mode
- **WHEN** the kiosk is running in production mode
- **THEN** ICE_SERVERS only includes STUN servers (TURN is configured via domain, not hardcoded)

### Requirement: TURN ICE servers in dashboard
The dashboard app SHALL include the local TURN server in its ICE servers configuration.

#### Scenario: Dashboard TURN in development
- **WHEN** the dashboard is running in development mode
- **THEN** ICE_SERVERS includes the TURN server alongside STUN servers

### Requirement: ICE server configuration consistency
Both apps SHALL use the same ICE server configuration.

#### Scenario: Matching ICE servers
- **WHEN** comparing kiosk and dashboard ICE_SERVERS configurations
- **THEN** both include the same STUN and TURN server URLs
