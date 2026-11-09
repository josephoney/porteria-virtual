## ADDED Requirements

### Requirement: Device commands table

The system SHALL have a `device_commands` outbox for device actuation.

#### Scenario: Command columns
- **WHEN** the schema is inspected
- **THEN** `device_commands` includes `id`, `device_id`, `community_id`, `command`,
  `payload`, `request_id`, `status`, `attempts`, `available_at`, `sent_at`,
  `acked_at`, `last_error`, `created_at`

#### Scenario: Unique request id
- **WHEN** a command is inserted with a duplicate `request_id` for the same device
- **THEN** the database rejects it

#### Scenario: Command statuses
- **WHEN** a command is processed
- **THEN** its status is one of `pending`, `sent`, `acked`, `failed`, `expired`

### Requirement: Command creation

The system SHALL create a command instead of publishing directly to MQTT.

#### Scenario: Access actuation
- **WHEN** the access engine allows an access
- **THEN** a `device_command` is created with `command = 'open'` and the access
  `requestId`

#### Scenario: Idempotent actuation
- **WHEN** the same access `requestId` is processed again
- **THEN** no duplicate command is created

#### Scenario: Unsupported device
- **WHEN** the target device is offline or in maintenance
- **THEN** the command is rejected or queued according to policy

### Requirement: Command worker

A worker SHALL publish pending commands to MQTT.

#### Scenario: Claim command
- **WHEN** the worker polls
- **THEN** it claims pending commands with `FOR UPDATE SKIP LOCKED`
- **THEN** it publishes to the device command topic
- **THEN** it sets status `sent` and `sent_at`

#### Scenario: Publish failure
- **WHEN** the MQTT publish fails
- **THEN** the command returns to `pending` with backoff
- **THEN** `attempts` is incremented

### Requirement: Acknowledgement and timeout

Commands SHALL require an acknowledgement.

#### Scenario: Ack received
- **WHEN** the device publishes an ack for `requestId`
- **THEN** the command status becomes `acked`
- **THEN** `acked_at` is set

#### Scenario: Ack timeout
- **WHEN** no ack arrives within the configured timeout
- **THEN** the command is retried up to the maximum attempts
- **THEN** it becomes `failed` after exhaustion

#### Scenario: Late ack
- **WHEN** an ack arrives after the command failed
- **THEN** it is recorded for audit but does not reopen the command

### Requirement: Dead-letter and replay

Failed commands SHALL be inspectable and replayable.

#### Scenario: List failed commands
- **WHEN** an admin requests failed commands for a community
- **THEN** the response includes device, command, attempts, and last error

#### Scenario: Replay command
- **WHEN** an admin replays a failed command
- **THEN** it returns to `pending` with a new `requestId`
- **THEN** the replay is audited

### Requirement: Command observability

The system SHALL expose command health.

#### Scenario: Stats
- **WHEN** an operator requests command stats
- **THEN** the response includes `pending`, `sent`, `acked`, `failed`, and
  `oldestPendingAge`

#### Scenario: Lag warning
- **WHEN** `oldestPendingAge` exceeds threshold
- **THEN** an operational warning event is emitted
