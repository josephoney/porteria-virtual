## MODIFIED Requirements

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
