## ADDED Requirements

### Requirement: Role assignment policy

The system SHALL centralize who can assign each membership role.

#### Scenario: Platform admin assigns org_admin
- **WHEN** a platform admin creates or invites an `org_admin`
- **THEN** the assignment is allowed

#### Scenario: Org admin assigns community roles
- **WHEN** an `org_admin` creates a `community_admin`, `operator`, `guard`, or resident
  role in their organization
- **THEN** the assignment is allowed

#### Scenario: Community admin assigns community roles
- **WHEN** a `community_admin` creates an `operator`, `guard`, or resident role in their
  community
- **THEN** the assignment is allowed
- **THEN** assigning `org_admin` is rejected with 403

#### Scenario: No self-escalation
- **WHEN** a user tries to assign themselves a role higher than their current role
- **THEN** the assignment is rejected

#### Scenario: Scope mismatch
- **WHEN** a role is assigned outside the requester's organization or community
- **THEN** the assignment is rejected with 403/404
