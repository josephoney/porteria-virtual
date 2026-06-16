## ADDED Requirements

### Requirement: List events paginated
The API SHALL provide a `GET /api/events` endpoint returning paginated events with actor name join.

#### Scenario: Admin lists events
- **WHEN** an admin makes a GET request to `/api/events`
- **THEN** the response contains paginated events belonging to the admin's organization
- **THEN** each event includes `actorName` (joined from users table) when `actorId` is set
- **THEN** events are ordered by `createdAt` descending (most recent first)

#### Scenario: Operator lists events
- **WHEN** an operator makes a GET request to `/api/events`
- **THEN** the response contains events for their organization

#### Scenario: Non-authorized user
- **WHEN** a guard or resident makes a GET request to `/api/events`
- **THEN** the response has status 403

#### Scenario: Pagination
- **WHEN** a request is made with `?page=1&pageSize=20`
- **THEN** the response contains `{ data: [...], total, page, pageSize }`

#### Scenario: Filter by event type
- **WHEN** a request is made with `?eventType=door.open`
- **THEN** only events with `event_type = 'door.open'` are returned

#### Scenario: Filter by date range
- **WHEN** a request is made with `?from=2026-06-01T00:00:00Z&to=2026-06-10T23:59:59Z`
- **THEN** only events with `createdAt` within that range are returned
- **THEN** the TimescaleDB hypertable chunks ensure efficient time-range queries

### Requirement: Event stats endpoint
The API SHALL provide a `GET /api/events/stats` endpoint with aggregated event counts.

#### Scenario: Event stats by type
- **WHEN** an admin requests `/api/events/stats`
- **THEN** the response contains counts grouped by event type for the current day
- **THEN** the response includes `total` events for the day

#### Scenario: Stats scoped to organization
- **WHEN** an admin requests event stats
- **THEN** only events from their organization are counted
