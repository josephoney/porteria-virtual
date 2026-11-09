# event-outbox Specification

## Purpose
TBD - created by archiving change add-reliable-event-outbox. Update Purpose after archive.
## Requirements
### Requirement: Outbox events table

The system SHALL have an `outbox_events` table that stores events to be delivered
reliably.

#### Scenario: Outbox columns
- **WHEN** the schema is inspected
- **THEN** `outbox_events` includes `id`, `event_id`, `event_type`, `aggregate_type`,
  `aggregate_id`, `organization_id`, `community_id`, `payload`, `status`, `attempts`,
  `available_at`, `processed_at`, `last_error`, `created_at`

#### Scenario: Unique event id
- **WHEN** two rows are inserted with the same `event_id`
- **THEN** the database rejects the duplicate with a unique constraint violation

#### Scenario: Delivery index
- **WHEN** the migration is applied
- **THEN** an index exists on `(status, available_at)`

### Requirement: Transactional write

The system SHALL write the outbox row in the same transaction as the domain change.

#### Scenario: Successful transaction
- **WHEN** a domain change and its outbox insert commit
- **THEN** the event is available for delivery

#### Scenario: Rolled back transaction
- **WHEN** the domain change fails and the transaction rolls back
- **THEN** no outbox row exists
- **THEN** no event is delivered

### Requirement: Event envelope

Every outbox event SHALL carry a versioned envelope.

#### Scenario: Envelope fields
- **WHEN** an event is written
- **THEN** it contains `eventId`, `eventType`, `version`, `occurredAt`,
  `organizationId`, optional `communityId`, optional `actor`, optional
  `accessPointId`, and `payload`

#### Scenario: Producer-generated id
- **WHEN** a producer writes an event
- **THEN** it generates the `eventId` UUID before inserting
- **THEN** retries reuse the same `eventId`

### Requirement: Outbox status lifecycle

Outbox rows SHALL move through `pending`, `processing`, `done`, and `dead`.

#### Scenario: Initial status
- **WHEN** an outbox row is inserted
- **THEN** its status is `pending`
- **THEN** `available_at` defaults to now

#### Scenario: Successful delivery
- **WHEN** the worker delivers the event
- **THEN** the status becomes `done` and `processed_at` is set

#### Scenario: Exhausted retries
- **WHEN** attempts reach the configured maximum
- **THEN** the status becomes `dead`
- **THEN** `last_error` contains the final error

### Requirement: Cross-service producers

Services without direct database access SHALL be able to enqueue events through an
internal endpoint.

#### Scenario: Signaling writes directly
- **WHEN** signaling emits an event
- **THEN** it writes to `outbox_events` using `@porteria/database` in a transaction
- **THEN** it does not call the API over HTTP

#### Scenario: External producer enqueue
- **WHEN** an internal producer cannot access the database
- **THEN** it posts to `POST /api/internal/outbox` with a valid internal key
- **THEN** the row is inserted idempotently by `eventId`

