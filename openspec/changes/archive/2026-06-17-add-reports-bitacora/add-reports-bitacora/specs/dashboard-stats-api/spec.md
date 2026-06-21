## MODIFIED Requirements

### Requirement: Dashboard aggregated stats
The API SHALL provide a `GET /api/dashboard/stats` endpoint with aggregated counts for the dashboard, supporting optional date range.

#### Scenario: Dashboard stats for today (default)
- **WHEN** an admin or operator requests `/api/dashboard/stats` without parameters
- **THEN** the response contains:
  - `totalKiosks`: count of all kiosks
  - `callsToday`: count of calls started today
  - `eventsToday`: count of events created today
  - `activeCalls`: count of calls currently in 'active' or 'pending' status

#### Scenario: Dashboard stats with date range
- **WHEN** an admin requests `/api/dashboard/stats?from=2026-06-01T00:00:00Z&to=2026-06-15T23:59:59Z`
- **THEN** `callsToday` and `eventsToday` reflect the specified range instead of the current day

#### Scenario: Stats scoped to organization
- **WHEN** an admin requests dashboard stats
- **THEN** only data from their organization is counted

#### Scenario: Non-authorized user
- **WHEN** a guard or resident requests dashboard stats
- **THEN** the response has status 403
