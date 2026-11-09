## ADDED Requirements

### Requirement: Outbox worker

The API SHALL run a worker that delivers pending outbox events.

#### Scenario: Claim a batch
- **WHEN** the worker polls
- **THEN** it selects up to the configured batch size of `pending` rows whose
  `available_at <= now()`
- **THEN** it claims them with `FOR UPDATE SKIP LOCKED`
- **THEN** it marks them `processing`

#### Scenario: Concurrent workers
- **WHEN** two workers poll at the same time
- **THEN** each row is claimed by only one worker

#### Scenario: Empty queue
- **WHEN** there are no pending rows
- **THEN** the worker waits for the next interval without error

### Requirement: Delivery to the event store

The worker SHALL deliver each event to the idempotent internal ingestion endpoint or
directly to `events`.

#### Scenario: Successful delivery
- **WHEN** the event is accepted by the consumer
- **THEN** the row is marked `done`
- **THEN** `attempts` is incremented

#### Scenario: Consumer unavailable
- **WHEN** the consumer returns a 5xx or times out
- **THEN** the row returns to `pending`
- **THEN** `available_at` is set using exponential backoff with jitter

#### Scenario: Permanent error
- **WHEN** the consumer returns a 4xx validation error
- **THEN** the event is marked `dead` immediately
- **THEN** the error is recorded

### Requirement: Idempotent ingestion

The internal event ingestion SHALL deduplicate by `eventId`.

#### Scenario: First delivery
- **WHEN** `/api/internal/events` receives an event with a new `eventId`
- **THEN** it inserts the event and returns 201

#### Scenario: Duplicate delivery
- **WHEN** `/api/internal/events` receives the same `eventId` again
- **THEN** it returns 200 without inserting a duplicate

#### Scenario: Missing event id
- **WHEN** an internal event is posted without `eventId`
- **THEN** the response has status 400

### Requirement: Dead-letter and replay

Operators SHALL be able to inspect and replay dead-lettered events.

#### Scenario: List dead events
- **WHEN** an admin requests `GET /api/internal/outbox/dead`
- **THEN** dead events are returned with `eventType`, `attempts`, and `lastError`

#### Scenario: Replay dead event
- **WHEN** an admin posts `POST /api/internal/outbox/:id/replay`
- **THEN** the event returns to `pending` with `attempts = 0`
- **THEN** the replay is audited with the admin id

#### Scenario: Replay bulk
- **WHEN** an admin replays a range of dead events
- **THEN** the API enforces a maximum batch and reports accepted/rejected counts

### Requirement: Outbox observability

The system SHALL expose outbox health metrics.

#### Scenario: Metrics endpoint
- **WHEN** an operator requests `GET /api/internal/outbox/stats`
- **THEN** the response includes `pending`, `processing`, `dead`, `oldestPendingAge`,
  and `lastError`

#### Scenario: Lag alert
- **WHEN** `oldestPendingAge` exceeds the configured threshold
- **THEN** the system emits an operational warning event

#### Scenario: Purge processed
- **WHEN** a `done` row is older than the retention window
- **THEN** an administrative job purges it
- **THEN** the purge is audited
