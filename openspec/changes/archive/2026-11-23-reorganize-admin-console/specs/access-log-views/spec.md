## ADDED Requirements

### Requirement: Bitacora legible

The dashboard SHALL expose a human-readable access log per community entrance.

#### Scenario: Access entry fields
- **WHEN** an access entry is shown in the Bitacora
- **THEN** it shows date, time, result/observation, person entering, vehicle, guard,
  authorizing person, destination section and destination unit
- **THEN** it identifies the community and the entrance/access point

#### Scenario: Result values
- **WHEN** an access entry is rendered
- **THEN** the result is one of authorized, denied, or code failure
- **THEN** the UI uses readable labels and badges instead of raw event codes

#### Scenario: Entrance and guards
- **WHEN** a community has one or more guards and entrances
- **THEN** the Bitacora can be filtered by community, entrance, guard, date and result
- **THEN** each entry is associated with the entrance where the access occurred

#### Scenario: Bitacora scope
- **WHEN** a guard or operator opens the Bitacora
- **THEN** only entries of their active community are shown
- **WHEN** a community_admin opens the Bitacora
- **THEN** only entries of their community are shown
- **WHEN** an org_admin opens the Bitacora
- **THEN** entries of their organization are shown
- **WHEN** a superadmin opens the Bitacora
- **THEN** entries across organizations are shown

#### Scenario: No raw JSON by default
- **WHEN** the Bitacora renders an entry
- **THEN** it shows human-readable fields
- **THEN** raw metadata is not the primary presentation

### Requirement: Historial tecnico

The dashboard SHALL expose a technical access history for diagnosis.

#### Scenario: Technical fields
- **WHEN** an entry is shown in the Historial
- **THEN** it includes all Bitacora fields plus organization, community, event id, actor,
  access point, code traceability, generation time, generation actor and usage time

#### Scenario: Code traceability
- **WHEN** an access code or QR is involved
- **THEN** the Historial shows when it was generated, who generated it, when it was used
  and the related event/error metadata

#### Scenario: Diagnosis
- **WHEN** an access fails because the code does not work
- **THEN** the Historial exposes the technical event and error details needed to
  diagnose the failure

#### Scenario: Historial scope
- **WHEN** a superadmin opens the Historial
- **THEN** entries across organizations and communities are shown
- **THEN** filters include organization, community, entrance, date, result and actor

#### Scenario: Historial access
- **WHEN** a guard, operator, community_admin or org_admin opens the Historial
- **THEN** the Historial is not offered in their navigation
- **THEN** a direct request is rejected with 403

### Requirement: Reportes operativos

The dashboard SHALL expose reports derived from access and call activity.

#### Scenario: Report visibility
- **WHEN** a guard, operator, community_admin or org_admin opens Reportes
- **THEN** they see metrics scoped to their community or organization

#### Scenario: Superadmin reports
- **WHEN** a superadmin opens Reportes
- **THEN** they can filter by organization and community

#### Scenario: Report periods
- **WHEN** the user selects daily, weekly or monthly
- **THEN** the report updates for that period and scope

### Requirement: Access log navigation

The access log views SHALL be reachable from the sidebar according to role.

#### Scenario: Guard and operator
- **WHEN** a guard or operator is in a tenant context
- **THEN** the sidebar shows Bitacora and Reportes under Analisis
- **THEN** it does not show Historial

#### Scenario: Community admin
- **WHEN** a community_admin is in a tenant context
- **THEN** the sidebar shows Bitacora and Reportes under Analisis
- **THEN** it does not show Historial

#### Scenario: Org admin
- **WHEN** an org_admin is in a tenant context
- **THEN** the sidebar shows Bitacora and Reportes under Analisis
- **THEN** it does not show Historial

#### Scenario: Superadmin
- **WHEN** a superadmin is in platform context
- **THEN** the sidebar shows Bitacora, Reportes and Historial under Analisis
