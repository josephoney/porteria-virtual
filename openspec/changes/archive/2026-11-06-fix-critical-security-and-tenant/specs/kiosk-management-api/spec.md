## ADDED Requirements

### Requirement: Kiosk resolution by tenant

The internal kiosk resolution SHALL be tenant-safe.

#### Scenario: Resolve with unique rpi
- **WHEN** `GET /api/internal/kiosks/resolve?rpiId=<id>` is called and the id is globally
  unique
- **THEN** the kiosk, community, and organization are returned

#### Scenario: Ambiguous rpi
- **WHEN** the `rpiId` matches more than one kiosk
- **THEN** the response has status 409 with a clear error

#### Scenario: Resolve with community
- **WHEN** the request includes `communityId`
- **THEN** the kiosk is resolved within that community
- **THEN** a kiosk from another community is not returned

#### Scenario: Cross-tenant attack
- **WHEN** a caller tries to resolve a kiosk of another organization
- **THEN** the response is 404
