## ADDED Requirements

### Requirement: Event list actor filter
The `GET /api/events` endpoint SHALL support filtering by actor.

#### Scenario: Filter by actor
- **WHEN** a request is made with `?actorId=<uuid>`
- **THEN** only events where `actor_id` matches are returned

### Requirement: Event list access point filter
The `GET /api/events` endpoint SHALL support filtering by access point.

#### Scenario: Filter by access point
- **WHEN** a request is made with `?accessPointId=<uuid>`
- **THEN** only events where `access_point_id` matches are returned

## MODIFIED Requirements

### Requirement: Event stats endpoint
The API SHALL provide a `GET /api/events/stats` endpoint with aggregated event counts for a configurable date range.

#### Scenario: Event stats by type for today
- **WHEN** an admin requests `/api/events/stats` without date parameters
- **THEN** the response contains counts grouped by event type for the current day
- **THEN** the response includes `total` events for the day

#### Scenario: Event stats with date range
- **WHEN** an admin requests `/api/events/stats?from=2026-06-01&to=2026-06-15`
- **THEN** the response contains counts grouped by event type for the specified date range
- **THEN** the response includes `total` events for the range

#### Scenario: Stats scoped to organization
- **WHEN** an admin requests event stats
- **THEN** only events from their organization are counted
