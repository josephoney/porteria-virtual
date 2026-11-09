## ADDED Requirements

### Requirement: Edge agent cache

The edge agent SHALL cache the policy needed to operate offline.

#### Scenario: Policy cache
- **WHEN** the agent starts
- **THEN** it fetches and verifies the signed policy snapshot
- **THEN** it caches rules, access points, public keys, and credential metadata

#### Scenario: Snapshot refresh
- **WHEN** the snapshot approaches expiration
- **THEN** the agent refreshes it in the background

#### Scenario: Expired snapshot
- **WHEN** the snapshot is expired and the API is unreachable
- **THEN** the agent applies each access point `fail_policy`

### Requirement: Local command execution

The edge agent SHALL execute device commands locally when offline.

#### Scenario: Local actuation
- **WHEN** the agent is offline and decides an allow
- **THEN** it executes the command against the hardware
- **THEN** it queues the access log and command result

#### Scenario: Command queue
- **WHEN** a command cannot be executed immediately
- **THEN** the agent queues it with its `requestId`
- **THEN** it retries idempotently

#### Scenario: Local rate limit
- **WHEN** too many commands arrive in a short window
- **THEN** the agent throttles and records a warning

### Requirement: Offline log queue

The edge agent SHALL queue logs and events for later sync.

#### Scenario: Queue access log
- **WHEN** an access decision occurs offline
- **THEN** the agent queues it with `occurredAt` and `requestId`

#### Scenario: Sync on reconnect
- **WHEN** connectivity returns
- **THEN** the agent posts queued logs in order
- **THEN** the server deduplicates by `requestId`

#### Scenario: Queue limits
- **WHEN** the queue reaches its limit
- **THEN** the agent drops the oldest non-critical entries
- **THEN** it never drops security-critical entries

### Requirement: Agent heartbeat and health

The agent SHALL report health and device status.

#### Scenario: Heartbeat
- **WHEN** the agent is running
- **THEN** it publishes a heartbeat every configured interval

#### Scenario: Degraded mode
- **WHEN** the agent cannot reach the API or MQTT
- **THEN** it reports `degraded` and continues local operation

#### Scenario: Recovery
- **WHEN** connectivity returns
- **THEN** it reports `online` and syncs logs

### Requirement: Agent security

The agent SHALL authenticate and protect local data.

#### Scenario: Device identity
- **WHEN** the agent connects
- **THEN** it authenticates with its device token or mTLS

#### Scenario: Local storage encryption
- **WHEN** templates or sensitive data are cached
- **THEN** they are encrypted at rest

#### Scenario: Tamper detection
- **WHEN** a cached policy signature is invalid
- **THEN** the agent rejects it and reports a security event
