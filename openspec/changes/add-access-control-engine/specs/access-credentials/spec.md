## ADDED Requirements

### Requirement: Credentials table

The system SHALL have a `credentials` table representing any access credential,
scoped to a community and to a subject.

#### Scenario: Create credential

- **WHEN** a credential is created with `community_id`, `type`, `subject_type`,
  `subject_id`, `secret_hash` or `secret_ref`, and a validity window
- **THEN** the row is persisted with an auto-generated UUID and timestamps
- **THEN** its `status` defaults to `active` and `used_count` defaults to `0`

#### Scenario: Tenant isolation

- **WHEN** a credential is queried
- **THEN** it MUST belong to the caller's organization
- **THEN** cross-organization lookups return not found

#### Scenario: Cascade delete subject

- **WHEN** the referenced subject (user or visitor) is deleted
- **THEN** its credentials are deleted or anonymized according to retention policy

### Requirement: Credential types

Credentials SHALL support the types `qr`, `pin`, `rfid`, `biometric`, and `plate`.

#### Scenario: Valid type accepted

- **WHEN** a credential is created with `type = 'qr'`
- **THEN** the value is persisted

#### Scenario: Invalid type rejected

- **WHEN** a credential is created with a type outside the allowed set
- **THEN** the database rejects the insertion

#### Scenario: Biometric credential references a template

- **WHEN** a credential of type `biometric` is created
- **THEN** `secret_ref` references a biometric template owned by the subject
- **THEN** no biometric template is embedded in the credential row

### Requirement: Signed QR token contract

A `qr` credential SHALL be presented as a short-lived signed token, never as a static
code.

#### Scenario: Token payload

- **WHEN** a QR credential is issued
- **THEN** the token payload contains `{ jti, credentialId, communityId,
  accessPointIds?, iat, exp, maxUses }`
- **THEN** the token is signed with Ed25519 (JWT `EdDSA`)

#### Scenario: Offline signature verification

- **WHEN** a device holds the current public key
- **THEN** it can verify the token signature and expiration without contacting the API

#### Scenario: Static or unsigned code rejected

- **WHEN** a presented QR is not a valid signed token
- **THEN** the decision is `deny` with reason `invalid_token`

#### Scenario: Short-lived resident token

- **WHEN** a resident displays an identity QR
- **THEN** the token expires within 60 seconds and the app requests a new one

#### Scenario: Visitor pass token

- **WHEN** a visitor pass QR is issued
- **THEN** its `exp` matches the pass validity window and its `maxUses` matches the
  configured limit

### Requirement: Credential lifecycle

Credentials SHALL support issuance, revocation, expiration, and usage accounting.

#### Scenario: Revoke credential

- **WHEN** an authorized user sets a credential `status = 'revoked'`
- **THEN** subsequent verifications are denied with reason `revoked`
- **THEN** the revocation is included in the policy delta

#### Scenario: Expired credential

- **WHEN** `valid_until` is in the past at verification time
- **THEN** the decision is `deny` with reason `expired`

#### Scenario: Max uses reached

- **WHEN** `used_count >= max_uses`
- **THEN** the decision is `deny` with reason `max_uses_reached`

#### Scenario: Atomic usage increment

- **WHEN** two verifications of the same credential arrive concurrently
- **THEN** only one succeeds when `max_uses = 1`
- **THEN** the counter is incremented atomically

### Requirement: PIN handling

PIN credentials SHALL be stored only as a strong hash and protected against brute
force.

#### Scenario: PIN is hashed

- **WHEN** a PIN credential is created
- **THEN** only an Argon2id or bcrypt hash is stored
- **THEN** the plain PIN is never persisted or logged

#### Scenario: PIN lockout

- **WHEN** a PIN fails 5 consecutive times for the same credential
- **THEN** the credential is temporarily locked
- **THEN** the lock is released after a configurable backoff period

#### Scenario: PIN rate limiting

- **WHEN** verification attempts exceed the configured rate for a device
- **THEN** further attempts are rejected with status 429

### Requirement: RFID and plate normalization

RFID UIDs and vehicle plates SHALL be normalized before comparison.

#### Scenario: RFID normalization

- **WHEN** an RFID UID is stored or compared
- **THEN** it is normalized to uppercase without separators
- **THEN** only its hash or a secure reference is stored

#### Scenario: Plate normalization

- **WHEN** a plate is stored or compared
- **THEN** it is normalized to uppercase without spaces or hyphens
- **THEN** the original value is preserved for display
