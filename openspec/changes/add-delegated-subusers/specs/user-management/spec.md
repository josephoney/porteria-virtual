## ADDED Requirements

### Requirement: Subuser management API

The API SHALL expose subuser/delegation management.

#### Scenario: List subusers
- **WHEN** the main user lists subusers
- **THEN** the response includes person, mode, permissions, locations and status

#### Scenario: Create subuser
- **WHEN** the main user creates a managed or account subuser
- **THEN** the person and delegation are created in one transaction

#### Scenario: Update permissions
- **WHEN** the main user changes permissions/locations
- **THEN** the change applies immediately and is audited

#### Scenario: Revoke
- **WHEN** the main user revokes a delegation
- **THEN** the delegation becomes inactive
- **THEN** it is audited

#### Scenario: Out of scope
- **WHEN** a user manages subusers outside their locations
- **THEN** the response is 403/404
