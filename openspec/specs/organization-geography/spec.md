# organization-geography Specification

## Purpose
TBD - created by archiving change extend-organization-profile. Update Purpose after archive.
## Requirements
### Requirement: Geography columns

`organizations` and `communities` SHALL have `municipality`, `department` and `country` columns, each `varchar(120)` and nullable.

#### Scenario: Existing rows

- **WHEN** the migration runs on a database with existing organizations and communities
- **THEN** the new columns are added without a default
- **THEN** existing rows keep `null` in all three columns

#### Scenario: New record with geography

- **WHEN** an organization or community is created with `municipality = 'Medellín'`, `department = 'Antioquia'` and `country = 'Colombia'`
- **THEN** the three values are persisted

#### Scenario: Cleared field

- **WHEN** an update sends an empty string for one of the three fields
- **THEN** the column is stored as `null`

#### Scenario: Overlong value

- **WHEN** a value longer than 120 characters is sent
- **THEN** the response has status 400

### Requirement: Geography in forms

Mi Organización, the platform organization form and the community form SHALL include Municipio, Departamento and País.

#### Scenario: New organization or community

- **WHEN** the form opens for a new record
- **THEN** País defaults to “Colombia”
- **THEN** Municipio and Departamento are empty

#### Scenario: Existing record

- **WHEN** the form opens for an existing record
- **THEN** each field shows the stored value or stays empty when it is `null`

#### Scenario: Save and reload

- **WHEN** the user saves the three fields and reloads the page
- **THEN** the stored values are shown again

#### Scenario: Country list

- **WHEN** the user opens the País control
- **THEN** a static list of countries is offered
- **THEN** the value can be cleared

### Requirement: Geography in API contracts

The organization and community read and write endpoints SHALL expose the three fields.

#### Scenario: Write endpoints

- **WHEN** a client sends `municipality`, `department` or `country` to `PATCH /api/organizations/me`, `POST /api/platform/organizations`, `PATCH /api/platform/organizations/:id`, `POST /api/organizations/me/communities` or `PATCH /api/communities/:id`
- **THEN** the values are persisted

#### Scenario: Read endpoints

- **WHEN** a client reads `GET /api/organizations/me`, `GET /api/platform/organizations/:id/overview` or `GET /api/communities/:id/overview`
- **THEN** the response includes `municipality`, `department` and `country`

### Requirement: Geography in detail cards

Detail cards SHALL show Municipio, Departamento and País using the shared detail component.

#### Scenario: Fields present

- **WHEN** the organization or community detail is expanded
- **THEN** the three fields are listed with their labels

#### Scenario: Field absent

- **WHEN** a field is `null`
- **THEN** it renders “—”

