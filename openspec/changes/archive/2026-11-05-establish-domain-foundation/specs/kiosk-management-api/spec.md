## MODIFIED Requirements

### Requirement: List kiosks
The API SHALL provide a `GET /api/kiosks` endpoint returning all kiosks with their
community and access point info, scoped to the caller's organization.

#### Scenario: Admin lists kiosks
- **WHEN** an admin makes a GET request to `/api/kiosks`
- **THEN** the response contains all kiosks with `id`, `name`, `status`, `ipAddress`,
  `lastHeartbeat`
- **THEN** each kiosk includes `communityId`, `communityName`, `accessPointName`

#### Scenario: Operator lists kiosks
- **WHEN** an operator makes a GET request to `/api/kiosks`
- **THEN** the response contains kiosks of the operator's active community

#### Scenario: Filter by community
- **WHEN** a request is made with `?communityId=<uuid>`
- **THEN** only kiosks of that community are returned
- **THEN** the community must belong to the caller's organization

#### Scenario: Filter by status
- **WHEN** a request is made with `?status=online`
- **THEN** only kiosks with that status are returned

#### Scenario: Non-authorized user
- **WHEN** a guard or resident makes a GET request to `/api/kiosks`
- **THEN** the response has status 403

#### Scenario: Cross-tenant kiosk access
- **WHEN** a user requests kiosks of a community in another organization
- **THEN** the response has status 404
