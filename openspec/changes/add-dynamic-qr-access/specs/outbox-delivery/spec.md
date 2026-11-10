## ADDED Requirements

### Requirement: Topic-based outbox routing

The outbox delivery SHALL route events by topic so independent consumers do not compete.

#### Scenario: Topic column

- **WHEN** the migration runs
- **THEN** `outbox_events` gains `topic` varchar(20) NOT NULL default `events`

#### Scenario: Main worker claims events

- **WHEN** the MVP outbox worker polls
- **THEN** it claims only rows with `topic = 'events'`
- **THEN** it delivers them to the event store

#### Scenario: No double claim

- **WHEN** multiple workers poll at the same time
- **THEN** each row is claimed by exactly one worker
- **THEN** all workers use `FOR UPDATE SKIP LOCKED`

#### Scenario: Legacy rows

- **WHEN** the topic column is added
- **THEN** existing rows default to `topic = 'events'`

#### Scenario: Topic statistics

- **WHEN** outbox stats are requested
- **THEN** the response can be grouped by topic

### Requirement: Notification worker (Phase 2)

A separate notification worker SHALL consume notification events when Phase 2 is enabled.

#### Scenario: Notification worker claims notifications

- **WHEN** the notification worker polls
- **THEN** it claims only rows with `topic = 'notifications'`
- **THEN** it does not deliver them to the event store

#### Scenario: Reserved in MVP

- **WHEN** the MVP runs
- **THEN** no `notification.requested` events are produced
- **THEN** the notification worker is disabled
