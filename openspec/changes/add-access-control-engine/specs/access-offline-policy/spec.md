## ADDED Requirements

### Requirement: Policy snapshot

The API SHALL provide `GET /api/internal/access/policy-snapshot` for devices to cache
the minimum data needed to decide offline.

#### Scenario: Snapshot contents

- **WHEN** a device with a valid token requests the snapshot for its community
- **THEN** the response contains `version`, `issuedAt`, `expiresAt`, `publicKey`,
  `accessPoints`, `rules`, and active `credentials` represented by hashes or `jti`
- **THEN** the snapshot never contains raw PINs, tokens, or biometric templates

#### Scenario: Snapshot expiration

- **WHEN** the snapshot `expiresAt` has passed
- **THEN** the device MUST request a new snapshot before making offline decisions
- **THEN** if it cannot, it applies the access point `fail_policy`

#### Scenario: Local decision

- **WHEN** the device has a valid snapshot and no connectivity
- **THEN** it evaluates the request locally with the same deny-by-default semantics
- **THEN** it actuates according to the snapshot and `fail_policy`

### Requirement: Snapshot signature

The snapshot SHALL be signed so devices can trust it.

#### Scenario: Valid signature

- **WHEN** the device verifies the snapshot with the pinned public key
- **THEN** it accepts the snapshot

#### Scenario: Tampered snapshot

- **WHEN** the signature does not match
- **THEN** the device rejects the snapshot
- **THEN** it applies `fail_policy` and reports a security event

#### Scenario: Version rollback

- **WHEN** a snapshot has a lower `version` than the cached one
- **THEN** the device rejects it

### Requirement: Revocation delta

The API SHALL provide a delta endpoint so devices update revocations without a full
snapshot.

#### Scenario: Delta since version

- **WHEN** a device requests `GET /api/internal/access/policy-delta?since=<version>`
- **THEN** the response contains revoked credential ids, new rules, changed rules, and
  the new version
- **THEN** the delta is signed

#### Scenario: Delta too old

- **WHEN** the requested `since` version is older than the retention of deltas
- **THEN** the response instructs the device to fetch a full snapshot

### Requirement: Offline access queue

Devices SHALL queue offline decisions and synchronize them when connectivity returns.

#### Scenario: Queue offline log

- **WHEN** a device makes an offline decision
- **THEN** it stores the access log locally with `occurred_at` and `requestId`

#### Scenario: Sync offline logs

- **WHEN** connectivity returns
- **THEN** the device posts the queued logs to the API in order
- **THEN** the server deduplicates by `requestId`

#### Scenario: Queue limit

- **WHEN** the local queue reaches its configured limit
- **THEN** the device drops the oldest non-critical entries and records a warning event
- **THEN** it never drops entries marked as security-critical

### Requirement: Clock and timezone resilience

Offline evaluation SHALL tolerate clock drift.

#### Scenario: Device clock skew

- **WHEN** the device clock differs from the snapshot `issuedAt` beyond the configured
  tolerance
- **THEN** the device reports a warning and evaluates using the last known server time
  offset

#### Scenario: Community timezone

- **WHEN** evaluating schedules offline
- **THEN** the device uses the community timezone included in the snapshot
