## ADDED Requirements

### Requirement: Create subuser delegation

A main user SHALL create subusers within their locations.

#### Scenario: Managed subuser
- **WHEN** the main user creates a subuser without a contact email/account
- **THEN** a person and a `managed` delegation are created
- **THEN** no account is created

#### Scenario: Subuser with account
- **WHEN** the main user creates a subuser with a contact email and account
- **THEN** the person, account and `account` delegation are created

#### Scenario: Out-of-scope location
- **WHEN** the main user tries to delegate a location they do not manage
- **THEN** the request is rejected with 403

#### Scenario: Duplicate person
- **WHEN** the document/email matches an existing person
- **THEN** the system reuses the person and creates the delegation

### Requirement: Delegated permissions

Permissions SHALL be explicit and scoped.

#### Scenario: Authorize visitors
- **WHEN** a delegation has `authorize_visitors = true`
- **THEN** the subuser can be selected as authorizer for passes in the delegated
  locations

#### Scenario: Manage locations
- **WHEN** a delegation has `manage_locations = true`
- **THEN** the subuser can edit the delegated locations

#### Scenario: View history
- **WHEN** a delegation has `view_history = true`
- **THEN** the subuser can see passes/scans of the delegated locations

#### Scenario: Manage subusers
- **WHEN** a subuser tries to create another subuser
- **THEN** the request is rejected (only the main user can manage subusers)

### Requirement: Authorizer traceability

Passes SHALL record who authorized the access.

#### Scenario: Main authorizer
- **WHEN** the main user creates a pass
- **THEN** `authorized_by_person_id` is the main person
- **THEN** `authorized_by_delegation_id` is null

#### Scenario: Subuser authorizer
- **WHEN** a subuser with `authorize_visitors` creates a pass
- **THEN** `authorized_by_person_id` is the subuser
- **THEN** `authorized_by_delegation_id` references the delegation
- **THEN** the bitácora shows the subuser and the main user

### Requirement: Revocation

The main user SHALL revoke a delegation.

#### Scenario: Revoke
- **WHEN** the main user revokes the delegation
- **THEN** the subuser can no longer create passes
- **THEN** the revocation is audited

#### Scenario: Existing passes
- **WHEN** the delegation is revoked
- **THEN** already used passes remain in history
- **THEN** pending passes are revoked according to policy

#### Scenario: Scope reduction
- **WHEN** a location is removed from the delegation
- **THEN** the subuser loses access to that location immediately

### Requirement: Subuser context

A subuser with account SHALL see only delegated locations.

#### Scenario: Login
- **WHEN** a subuser with account logs in
- **THEN** the token includes their person id and active delegations

#### Scenario: API scope
- **WHEN** the subuser requests locations/passes
- **THEN** only delegated locations are returned

#### Scenario: Managed subuser login
- **WHEN** a managed subuser tries to log in
- **THEN** the request is rejected because there is no account
