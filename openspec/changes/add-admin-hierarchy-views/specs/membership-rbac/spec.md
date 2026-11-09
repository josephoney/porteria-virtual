## ADDED Requirements

### Requirement: Organization admin implicit community scope

An organization administrator SHALL manage every community in their organization
without an additional community membership.

#### Scenario: Manage any organization community
- **WHEN** an `org_admin` accesses a community belonging to their organization
- **THEN** the request is authorized
- **THEN** no `community_admin` membership is required

#### Scenario: Cross-organization community
- **WHEN** an `org_admin` accesses a community from another organization
- **THEN** the response has status 404

### Requirement: Multi-community delegated administration

The system SHALL allow a person to hold multiple `community_admin` memberships.

#### Scenario: Two community memberships
- **WHEN** a person is assigned as `community_admin` to two communities
- **THEN** two active memberships exist
- **THEN** each membership grants access only to its community

#### Scenario: Context switch
- **WHEN** the person switches active context to one community
- **THEN** administrative actions are limited to that community

#### Scenario: No community creation
- **WHEN** a `community_admin` tries to create a community
- **THEN** the response has status 403

### Requirement: Superadmin tenant read-only

Platform administrators SHALL NOT mutate tenant hierarchy data.

#### Scenario: Read organization profile
- **WHEN** a platform admin reads an organization profile
- **THEN** the response is allowed

#### Scenario: Write organization profile
- **WHEN** a platform admin updates organization profile fields
- **THEN** the response has status 403

#### Scenario: Write community or location
- **WHEN** a platform admin creates or updates a community, section or unit
- **THEN** the response has status 403
