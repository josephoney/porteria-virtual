## ADDED Requirements

### Requirement: Delegated permission evaluation

Authorization SHALL combine membership role, delegation permissions and location scope.

#### Scenario: Main user
- **WHEN** the main person acts
- **THEN** their membership role and location associations apply

#### Scenario: Subuser with permission
- **WHEN** a subuser acts
- **THEN** the requested action must be granted in the delegation
- **THEN** the target location must be in the delegation scope

#### Scenario: Revoked delegation
- **WHEN** a delegation is inactive
- **THEN** the subuser's delegated permissions are denied

#### Scenario: No implicit escalation
- **WHEN** a subuser has no permission for an action
- **THEN** the response is 403
