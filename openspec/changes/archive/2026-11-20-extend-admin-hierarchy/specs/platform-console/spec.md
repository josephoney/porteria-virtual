## ADDED Requirements

### Requirement: Staff management in platform console

The platform console SHALL let superadmins manage operational staff.

#### Scenario: Create operator
- **WHEN** a superadmin creates an operator
- **THEN** they select an organization and one or more communities
- **THEN** the operator memberships are created

#### Scenario: Create guard
- **WHEN** a superadmin creates a guard
- **THEN** they select an organization and one or more communities
- **THEN** the guard memberships are created

#### Scenario: Edit staff assignments
- **WHEN** a superadmin edits a staff member
- **THEN** they can add/remove communities
- **THEN** the change is audited

#### Scenario: List staff
- **WHEN** a superadmin lists staff
- **THEN** the response includes role, organization, communities and status

### Requirement: Global reports in platform console

The platform console SHALL expose global reports.

#### Scenario: Report by organization
- **WHEN** a superadmin selects an organization
- **THEN** the report shows its communities and aggregated metrics

#### Scenario: Report by community
- **WHEN** a superadmin selects a community
- **THEN** the report shows its users, staff, access and pass metrics

#### Scenario: Export
- **WHEN** a superadmin exports a report
- **THEN** the export is scoped to the selected filters
