## ADDED Requirements

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

## MODIFIED Requirements

### Requirement: List calls paginated (modified)
> Adds `operatorId` filter. Operators are restricted to their own calls.

#### Scenario: Operator lists only their own calls
- **WHEN** an operator makes a GET request to `/api/calls`
- **THEN** only calls where `operatorId` matches the operator's user ID are returned
- **THEN** any `?operatorId=` query parameter is ignored (forced to own ID)

#### Scenario: Admin can filter by operatorId
- **WHEN** an admin makes a GET request to `/api/calls?operatorId=<uuid>`
- **THEN** only calls with that `operatorId` are returned

#### Scenario: Admin lists all calls without operator filter
- **WHEN** an admin makes a GET request to `/api/calls` without `operatorId`
- **THEN** all calls in the organization are returned (existing behavior)
