## ADDED Requirements

### Requirement: List kiosks
The API SHALL provide a `GET /api/kiosks` endpoint returning all kiosks with their access point and location info.

#### Scenario: Admin lists kiosks
- **WHEN** an admin makes a GET request to `/api/kiosks`
- **THEN** the response contains all kiosks with `id`, `name`, `status`, `ipAddress`, `lastHeartbeat`
- **THEN** each kiosk includes `accessPointName` and `locationName` (joined)

#### Scenario: Operator lists kiosks
- **WHEN** an operator makes a GET request to `/api/kiosks`
- **THEN** the response contains kiosks for their organization

#### Scenario: Filter by status
- **WHEN** a request is made with `?status=online`
- **THEN** only kiosks with that status are returned

#### Scenario: Non-authorized user
- **WHEN** a guard or resident makes a GET request to `/api/kiosks`
- **THEN** the response has status 403
