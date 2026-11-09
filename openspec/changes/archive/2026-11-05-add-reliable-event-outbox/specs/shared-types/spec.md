## ADDED Requirements

### Requirement: Event envelope type

The shared package SHALL define the versioned event envelope used by producers and
consumers.

#### Scenario: Envelope fields
- **WHEN** a developer inspects `EventEnvelope`
- **THEN** it includes `eventId`, `eventType`, `version`, `occurredAt`,
  `organizationId`, `communityId?`, `actor?`, `accessPointId?`, `payload`

#### Scenario: Producer helper
- **WHEN** a producer creates an envelope
- **THEN** `eventId` is a new UUID and `occurredAt` is an ISO timestamp

### Requirement: Outbox status type

The shared package SHALL define the outbox lifecycle statuses.

#### Scenario: Outbox status enum
- **WHEN** a developer uses `OutboxStatus.Pending`
- **THEN** the value is the string `'pending'`
- **THEN** the enum includes `Pending`, `Processing`, `Done`, and `Dead`

#### Scenario: Outbox stats type
- **WHEN** a developer inspects `OutboxStats`
- **THEN** it includes `pending`, `processing`, `dead`, `oldestPendingAge`, and
  `lastError`
