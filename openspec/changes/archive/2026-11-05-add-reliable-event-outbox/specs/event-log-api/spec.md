## ADDED Requirements

### Requirement: Idempotent internal event ingestion

The API SHALL expose `POST /api/internal/events` with idempotent ingestion by
`eventId`.

#### Scenario: New event
- **WHEN** a valid internal request includes a new `eventId`
- **THEN** the event is inserted into `events` and the response has status 201

#### Scenario: Duplicate event
- **WHEN** a request includes an `eventId` already ingested
- **THEN** the response has status 200 and no second row is inserted

#### Scenario: Missing event id
- **WHEN** a request omits `eventId`
- **THEN** the response has status 400 with validation details

#### Scenario: Invalid internal key
- **WHEN** a request has no valid `X-Internal-Key`
- **THEN** the response has status 401

### Requirement: Outbox enqueue endpoint

The API SHALL expose `POST /api/internal/outbox` for producers without database access.

#### Scenario: Enqueue event
- **WHEN** a valid internal request posts an `EventEnvelope`
- **THEN** the outbox row is inserted with status `pending`

#### Scenario: Duplicate enqueue
- **WHEN** the same `eventId` is posted again
- **THEN** the response returns the existing row without duplicating it
