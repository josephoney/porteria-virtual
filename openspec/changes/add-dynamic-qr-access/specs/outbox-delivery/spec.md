## ADDED Requirements

### Requirement: Topic-based outbox routing

The outbox delivery SHALL route events by topic so independent consumers do not compete.

#### Scenario: Main worker claims events
- **WHEN** the main outbox worker polls
- **THEN** it claims only rows with `topic = 'events'`
- **THEN** it delivers them to the event store

#### Scenario: Notification worker claims notifications
- **WHEN** the notification worker polls
- **THEN** it claims only rows with `topic = 'notifications'`
- **THEN** it does not deliver them to the event store

#### Scenario: No double claim
- **WHEN** both workers poll at the same time
- **THEN** each row is claimed by exactly one worker
- **THEN** both use `FOR UPDATE SKIP LOCKED`

#### Scenario: Legacy rows
- **WHEN** the topic column is added
- **THEN** existing rows default to `topic = 'events'`

#### Scenario: Topic statistics
- **WHEN** outbox stats are requested
- **THEN** the response can be grouped by topic
