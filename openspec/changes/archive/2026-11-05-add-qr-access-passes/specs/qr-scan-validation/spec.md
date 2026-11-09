## ADDED Requirements

### Requirement: Scan endpoint

The API SHALL expose `POST /api/internal/access/scan` for kiosks and scanners.

#### Scenario: Valid scan
- **WHEN** a device posts a signed token with `deviceId`, `communityId`, and
  `accessPointId`
- **THEN** the token is decoded and forwarded to the access decision engine
- **THEN** the response contains `decision`, `reason`, and `passId`

#### Scenario: Malformed token
- **WHEN** the token cannot be decoded or the signature is invalid
- **THEN** the response is `deny` with reason `invalid_token`

#### Scenario: Device not authorized
- **WHEN** the device token is invalid or belongs to another community
- **THEN** the response has status 401 or 403

### Requirement: Pass validation

The scan SHALL validate the pass lifecycle and constraints through the engine.

#### Scenario: Active pass
- **WHEN** the pass is active, in its validity window, and under its usage limit
- **THEN** the engine evaluates the access rules

#### Scenario: Expired pass
- **WHEN** the pass is outside its validity window
- **THEN** the decision is `deny` with reason `expired`

#### Scenario: Revoked pass
- **WHEN** the pass is revoked
- **THEN** the decision is `deny` with reason `revoked`

#### Scenario: Max uses reached
- **WHEN** the pass reached its `maxUses`
- **THEN** the decision is `deny` with reason `max_uses_reached`

#### Scenario: Wrong access point
- **WHEN** the pass is used at an access point outside its scope
- **THEN** the decision is `deny` with reason `out_of_scope`

### Requirement: Offline scan

Devices SHALL validate QR tokens offline using the policy snapshot.

#### Scenario: Offline valid token
- **WHEN** the device has a valid snapshot and no connectivity
- **THEN** it verifies the signature and expiration locally
- **THEN** it applies local rules and the access point `fail_policy`

#### Scenario: Offline revoked pass
- **WHEN** the revocation arrives in the next delta
- **THEN** subsequent offline scans are denied

#### Scenario: Snapshot expired
- **WHEN** the snapshot is expired and connectivity is unavailable
- **THEN** the device applies `fail_policy`

### Requirement: Notification on arrival

The system SHALL notify the resident when a visitor pass is first used.

#### Scenario: First valid use
- **WHEN** a `visitor` pass is used successfully for the first time
- **THEN** a `visitor_arrived` notification is sent to the unit's resident

#### Scenario: Subsequent uses
- **WHEN** the same pass is used again
- **THEN** no duplicate arrival notification is sent unless configured

#### Scenario: Delivery pass
- **WHEN** a `delivery` pass is used
- **THEN** the resident receives a delivery notification

### Requirement: Scan privacy

Scan responses and logs SHALL NOT expose unnecessary personal data.

#### Scenario: Denied response
- **WHEN** a scan is denied
- **THEN** the response does not include holder identity details

#### Scenario: Audit
- **WHEN** a scan is processed
- **THEN** an `access` log is recorded with `passId` and credential `jti`
- **THEN** the raw token is not stored
