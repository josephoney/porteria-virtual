## MODIFIED Requirements

### Requirement: Default access point

The system SHALL use the workstation assigned to the guard membership as the default
access point, and only the workstation resource SHALL change it.

#### Scenario: Start with default

- **WHEN** a guard with an assigned workstation starts a shift without choosing a gate
- **THEN** the shift starts at the assigned access point

#### Scenario: No default

- **WHEN** a guard without an assigned workstation starts a shift
- **THEN** the request must include an active access point of the guard's community
- **THEN** otherwise the response has status 400

#### Scenario: Default out of scope

- **WHEN** the assigned access point belongs to another community or is inactive
- **THEN** the guard must choose another active access point

#### Scenario: Assignment change during an open shift

- **WHEN** the workstation is reassigned while the guard has an open shift
- **THEN** the open segment keeps its access point
- **THEN** the new assignment is used from the next shift

#### Scenario: Assignment does not restrict the shift

- **WHEN** a guard with an assigned workstation starts a shift at another active access
  point of their community
- **THEN** the shift starts at the chosen access point
- **THEN** the assignment remains unchanged

#### Scenario: Assignment survives deactivation of the access point

- **WHEN** the assigned access point is deactivated and later reactivated
- **THEN** the guard starts shifts there again without being reassigned
