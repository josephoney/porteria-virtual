## Purpose

Paginated call history with role-scoped listings and call metrics for the dashboard.
## Requirements
### Requirement: List calls paginated
The API SHALL provide a `GET /api/calls` endpoint returning paginated call history with
joined kiosk and operator names, scoped by role.

#### Scenario: Org admin lists calls
- **WHEN** an `org_admin` makes a GET request to `/api/calls`
- **THEN** the response contains paginated calls belonging to the admin's organization
- **THEN** each call includes `kioskName`, `operatorName`, and `accessPointName` (not
  just UUIDs)
- **THEN** calls are ordered by `startedAt` descending (most recent first)

#### Scenario: Community admin lists community calls
- **WHEN** a `community_admin` makes a GET request to `/api/calls`
- **THEN** only calls of their active community are returned
- **THEN** they are not restricted to calls they personally handled

#### Scenario: Operator lists only their own calls
- **WHEN** an operator makes a GET request to `/api/calls`
- **THEN** only calls where `operatorId` matches the operator's user ID are returned
- **THEN** any `?operatorId=` query parameter is ignored (forced to own ID)

#### Scenario: Non-authorized user
- **WHEN** a guard or resident makes a GET request to `/api/calls`
- **THEN** the response has status 403

#### Scenario: Platform context without tenant
- **WHEN** a platform admin without a tenant context makes a GET request to `/api/calls`
- **THEN** the response has status 403 with a "select a community" message

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

#### Scenario: Admin can filter by operatorId
- **WHEN** an admin makes a GET request to `/api/calls?operatorId=<uuid>`
- **THEN** only calls with that `operatorId` are returned

#### Scenario: Admin lists all calls without operator filter
- **WHEN** an admin makes a GET request to `/api/calls` without `operatorId`
- **THEN** all calls in their scope are returned

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

### Requirement: Internal create call endpoint
The API SHALL provide a `POST /api/internal/calls` endpoint for the signaling server to create call records. This endpoint uses internal API key authentication, not JWT.

#### Scenario: Create pending call from signaling
- **WHEN** a POST request is made to `/api/internal/calls` with header `X-Internal-Key` and body `{ callId, buildingId }`
- **THEN** the API resolves `buildingId` to `kioskId` via `kiosks.rpi_id`
- **THEN** the API resolves `organizationId` via kiosk → accessPoint → location chain
- **THEN** a row is inserted in `calls` with status `pending`, `startedAt = now()`
- **THEN** a `call.started` event is inserted in `events`
- **THEN** the response has status 201 with `{ success: true }`

#### Scenario: Kiosk not found by buildingId
- **WHEN** a POST request is made with a `buildingId` that doesn't match any `kiosks.rpi_id`
- **THEN** the response has status 400 with `{ success: false, error: "Kiosk not found" }`

#### Scenario: Kiosk not linked to organization
- **WHEN** the resolved kiosk has no `accessPointId` or its chain doesn't reach an `organizationId`
- **THEN** the response has status 400 with `{ success: false, error: "Kiosk not linked to an organization" }`

#### Scenario: Missing internal API key
- **WHEN** a request is made without a valid `X-Internal-Key` header
- **THEN** the response has status 401

#### Scenario: Call with visitor data
- **WHEN** a POST request includes optional `visitor: { name, known }`
- **THEN** the `call.started` event metadata includes the visitor info

### Requirement: Internal update call endpoint
The API SHALL provide a `PATCH /api/internal/calls/:callId` endpoint for the signaling server to update call status.

#### Scenario: Accept call (pending → active)
- **WHEN** a PATCH request is made with `{ status: "active", operatorId }`
- **THEN** the call's `status` is updated to `active` and `operatorId` is set
- **THEN** no event is created (the accept doesn't generate a separate event)

#### Scenario: End call (active → ended)
- **WHEN** a PATCH request is made with `{ status: "ended", endedAt, duration, eventType: "call.ended" }`
- **THEN** the call's `status`, `endedAt`, and `duration` are updated
- **THEN** a `call.ended` event is inserted in `events`

#### Scenario: Timeout or cancel (pending → missed)
- **WHEN** a PATCH request is made with `{ status: "missed", endedAt, eventType: "call.missed" }`
- **THEN** the call's `status` and `endedAt` are updated
- **THEN** a `call.missed` event is inserted in `events`

#### Scenario: Call not found for update
- **WHEN** a PATCH request is made for a non-existent `callId`
- **THEN** the response has status 404 with `{ success: false, error: "Call not found" }`

