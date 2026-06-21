## ADDED Requirements

### Requirement: Daily report endpoint
The API SHALL provide a `GET /api/reports/daily` endpoint returning aggregated data for a specific day.

#### Scenario: Daily report with counts
- **WHEN** an admin requests `/api/reports/daily?date=2026-06-15`
- **THEN** the response contains `{ date, totalCalls, answeredCalls, missedCalls, callsByHour: [{ hour, count }], totalDoorOpens, eventsByType: [{ eventType, count }] }`
- **THEN** all counts are scoped to the admin's organization

#### Scenario: Daily report defaults to today
- **WHEN** an admin requests `/api/reports/daily` without a date parameter
- **THEN** the report uses the current date

#### Scenario: Non-authorized user rejected
- **WHEN** a guard or resident requests `/api/reports/daily`
- **THEN** the response has status 403

### Requirement: Weekly report endpoint
The API SHALL provide a `GET /api/reports/weekly` endpoint returning daily breakdowns for a week.

#### Scenario: Weekly report with daily breakdown
- **WHEN** an admin requests `/api/reports/weekly?week=2026-06-15`
- **THEN** the response contains `{ weekStart, days: [{ date, totalCalls, answeredCalls, missedCalls, doorOpens }], totals: { calls, answered, missed, doors } }`
- **THEN** `weekStart` is the Monday of the requested week
- **THEN** if `week` is not a Monday, it is normalized to the preceding Monday

#### Scenario: Weekly report defaults to current week
- **WHEN** an admin requests `/api/reports/weekly` without parameters
- **THEN** the report uses the current week (Monday through Sunday)

### Requirement: Monthly report endpoint
The API SHALL provide a `GET /api/reports/monthly` endpoint returning aggregated data for a month.

#### Scenario: Monthly report with weekly breakdown
- **WHEN** an admin requests `/api/reports/monthly?month=2026-06`
- **THEN** the response contains `{ month, weeks: [{ weekStart, totalCalls, answeredCalls, missedCalls, doorOpens }], totals: { calls, answered, missed, doors } }`
- **THEN** data is grouped by ISO week within the month

#### Scenario: Monthly report defaults to current month
- **WHEN** an admin requests `/api/reports/monthly` without parameters
- **THEN** the report uses the current month

### Requirement: Call stats endpoint
The API SHALL provide a `GET /api/reports/call-stats` endpoint with aggregated call metrics.

#### Scenario: Call stats with metrics
- **WHEN** an admin requests `/api/reports/call-stats?from=2026-06-01&to=2026-06-15`
- **THEN** the response contains `{ totalCalls, answeredCount, missedCount, answerRate, avgDuration, callsByHour: [{ hour, count }], callsByKiosk: [{ kioskId, kioskName, count }] }`

#### Scenario: Call stats require date range
- **WHEN** a request is made without `from` and `to`
- **THEN** the response defaults to the last 7 days

### Requirement: Event breakdown endpoint
The API SHALL provide a `GET /api/reports/event-breakdown` endpoint using TimescaleDB time_bucket().

#### Scenario: Event breakdown by day
- **WHEN** an admin requests `/api/reports/event-breakdown?from=2026-06-01&to=2026-06-15&bucket=day`
- **THEN** the response contains `{ buckets: [{ time, call_started, call_ended, call_missed, door_open, ... }] }` using TimescaleDB `time_bucket('1 day', created_at)`
- **THEN** buckets with no events are filled with zero counts

#### Scenario: Event breakdown by hour
- **WHEN** a request specifies `bucket=hour`
- **THEN** the query uses `time_bucket('1 hour', created_at)` for aggregation

#### Scenario: Event breakdown requires date range
- **WHEN** a request is made without `from` and `to`
- **THEN** the response status is 400 with details specifying required parameters
