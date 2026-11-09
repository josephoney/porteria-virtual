## Purpose

Aggregated dashboard statistics for kiosks, calls, and access activity.

## Requirements

### Requirement: Dashboard aggregated stats
The API SHALL provide a `GET /api/dashboard/stats` endpoint with aggregated counts for the dashboard.

#### Scenario: Dashboard stats response
- **WHEN** an admin or operator requests `/api/dashboard/stats`
- **THEN** the response contains:
  - `totalKiosks`: count of all kiosks
  - `callsToday`: count of calls started today
  - `eventsToday`: count of events created today
  - `activeCalls`: count of calls currently in 'active' or 'pending' status

#### Scenario: Stats scoped to organization
- **WHEN** an admin requests dashboard stats
- **THEN** only data from their organization is counted

#### Scenario: Non-authorized user
- **WHEN** a guard or resident requests dashboard stats
- **THEN** the response has status 403
