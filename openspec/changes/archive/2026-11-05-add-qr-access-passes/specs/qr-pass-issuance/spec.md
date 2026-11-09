## ADDED Requirements

### Requirement: Create access pass

The API SHALL let authorized users create an access pass linked to a QR credential.

#### Scenario: Resident creates a pass
- **WHEN** a resident creates a pass for a unit they belong to
- **THEN** the pass is created with `status = 'active'` and a linked `qr` credential

#### Scenario: Guard creates a pass
- **WHEN** a guard creates a pass for a unit in their community
- **THEN** the pass is created and audited with the guard as creator

#### Scenario: Admin creates a pass
- **WHEN** a `community_admin` creates a pass for any unit in their community
- **THEN** the pass is created

#### Scenario: Pass required fields
- **WHEN** a pass is created
- **THEN** it requires `communityId`, `unitId`, `type`, `holderName`, `validFrom`,
  `validUntil`, and `accessPointIds`

### Requirement: Pass scope validation

The system SHALL prevent passes from being created outside the creator's scope.

#### Scenario: Resident outside own unit
- **WHEN** a resident tries to create a pass for another unit
- **THEN** the response has status 403

#### Scenario: Access point outside community
- **WHEN** a pass references an access point of another community
- **THEN** the response has status 404

#### Scenario: Cross-tenant attempt
- **WHEN** a user creates a pass in another organization
- **THEN** the response has status 404

### Requirement: Pass types and defaults

Pass types SHALL have configurable defaults per community.

#### Scenario: Type defaults
- **WHEN** a `delivery` pass is created without explicit duration
- **THEN** the community default duration for deliveries is applied

#### Scenario: Supported types
- **WHEN** a pass type is set
- **THEN** it is one of `visitor`, `delivery`, `provider`, `frequent`, `temporary`

#### Scenario: Invalid type
- **WHEN** an unsupported type is submitted
- **THEN** the response has status 400

### Requirement: Token issuance and regeneration

The system SHALL issue a signed QR token without storing it and allow rotation.

#### Scenario: Issue token
- **WHEN** an active pass is requested
- **THEN** a signed Ed25519 token is returned with `jti`, `exp`, and `maxUses`

#### Scenario: Token not stored
- **WHEN** the token is issued
- **THEN** only its `jti` and status are persisted
- **THEN** the token itself is never stored or logged

#### Scenario: Regenerate token
- **WHEN** the creator requests a new token for an active pass
- **THEN** a new `jti` is issued and the previous one is invalidated

#### Scenario: Regenerate revoked pass
- **WHEN** the pass is revoked or expired
- **THEN** regeneration is rejected

### Requirement: Issuance rate limits

The system SHALL limit pass creation to prevent abuse.

#### Scenario: Daily limit
- **WHEN** a unit exceeds the configured passes per day
- **THEN** further creation is rejected with status 429

#### Scenario: Rejected attempts audited
- **WHEN** a rate limit rejects a pass creation
- **THEN** an audit event records the unit, creator, and reason
