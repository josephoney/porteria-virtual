## ADDED Requirements

### Requirement: Rotating QR token

The system SHALL issue a signed QR token with a 24-second lifetime.

#### Scenario: Issue token
- **WHEN** the bound device or the authenticated resident requests a QR
- **THEN** the response contains a signed token and `expiresAt = now + 24 seconds`
- **THEN** the token payload contains `passId`, `jti`, `iat`, and `exp`

#### Scenario: Token not stored
- **WHEN** a token is issued
- **THEN** only its `jti` is recorded when it is scanned
- **THEN** the raw token is never persisted or logged

#### Scenario: Refresh
- **WHEN** the page refreshes before expiration
- **THEN** a new token with a new `jti` is issued

### Requirement: Single-use token

A QR token SHALL be usable only once.

#### Scenario: First scan
- **WHEN** a token is scanned for the first time
- **THEN** its `jti` is recorded in the scan
- **THEN** the token is consumed

#### Scenario: Replay
- **WHEN** the same token is scanned again
- **THEN** the response has status 409 with reason `token_already_used`

### Requirement: Public QR endpoint

The public page SHALL fetch QR tokens only for the bound device.

#### Scenario: Bound device
- **WHEN** the bound device requests a QR with a valid device cookie
- **THEN** the token is issued if the pass is active and inside the allowed schedule

#### Scenario: Missing or wrong device
- **WHEN** the request has no device cookie or a cookie for another pass
- **THEN** the response has status 403

#### Scenario: Outside schedule
- **WHEN** the pass is outside the allowed days or time window and outside presence is
  `outside`
- **THEN** the response has status 409 with reason `not_valid_now`
- **THEN** the response includes the next valid window if known

#### Scenario: Inside for exit
- **WHEN** an entry/exit pass is `inside` and the daily window has ended
- **THEN** a token is still issued so the guard can register the exit

### Requirement: Resident QR endpoint

The resident app SHALL be able to show a QR for in-person sharing.

#### Scenario: Resident requests QR
- **WHEN** the authenticated creator requests the QR of their active pass
- **THEN** a token is issued without device binding
- **THEN** the token follows the same 24-second and single-use rules

### Requirement: QR page refresh

The public pass page SHALL refresh the QR automatically.

#### Scenario: Refresh interval
- **WHEN** the page is open and the pass is valid
- **THEN** the page requests a new token every 20–24 seconds

#### Scenario: Pass consumed
- **WHEN** the status endpoint returns `used` or the QR endpoint returns `410`
- **THEN** the page stops refreshing and shows the final state
