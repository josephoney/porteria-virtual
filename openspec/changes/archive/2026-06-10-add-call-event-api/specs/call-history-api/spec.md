## ADDED Requirements

### Requirement: List calls paginated
The API SHALL provide a `GET /api/calls` endpoint returning paginated call history with joined kiosk and operator names.

#### Scenario: Admin lists calls
- **WHEN** an admin makes a GET request to `/api/calls`
- **THEN** the response contains paginated calls belonging to the admin's organization
- **THEN** each call includes `kioskName`, `operatorName`, and `accessPointName` (not just UUIDs)
- **THEN** calls are ordered by `startedAt` descending (most recent first)

#### Scenario: Operator lists calls
- **WHEN** an operator makes a GET request to `/api/calls`
- **THEN** the response contains calls for their organization

#### Scenario: Non-authorized user
- **WHEN** a guard or resident makes a GET request to `/api/calls`
- **THEN** the response has status 403

#### Scenario: Pagination
- **WHEN** a request is made with `?page=1&pageSize=10`
- **THEN** the response contains `{ data: [...], total, page, pageSize }`
- **THEN** `pageSize` is capped at 100

#### Scenario: Filter by status
- **WHEN** a request is made with `?status=active`
- **THEN** only calls with `status = 'active'` are returned

#### Scenario: Filter by date range
- **WHEN** a request is made with `?from=2026-06-01&to=2026-06-10`
- **THEN** only calls with `startedAt` within that range are returned

### Requirement: Get call by ID
The API SHALL provide a `GET /api/calls/:id` endpoint with joined detail.

#### Scenario: Call found
- **WHEN** an admin requests a call by ID from their organization
- **THEN** the response contains the full call detail with kiosk name, operator name, access point name

#### Scenario: Call not found
- **WHEN** a request is made for a non-existent call ID
- **THEN** the response has status 404

#### Scenario: Call from another organization
- **WHEN** a request is made for a call belonging to a different organization
- **THEN** the response has status 404 (don't leak existence)
