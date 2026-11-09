## ADDED Requirements

### Requirement: Pass entry notification

The resident SHALL be notified when a pass entry is confirmed.

#### Scenario: Entry confirmed
- **WHEN** a pass entry is confirmed
- **THEN** a `pass_entry` notification is created for the resident who created the pass
- **THEN** the notification includes the visitor first and last name
- **THEN** it includes the vehicle plate when the pass has a vehicle
- **THEN** it includes a deep link to the pass

#### Scenario: Push payload
- **WHEN** the push is sent
- **THEN** it may include the visitor name and plate
- **THEN** it never includes the cédula or biometric data

### Requirement: Pass exit notification

The resident SHALL be notified when a pass exit is confirmed.

#### Scenario: Exit confirmed
- **WHEN** a pass exit is confirmed
- **THEN** a `pass_exit` notification is created for the resident
- **THEN** it includes the visitor name and a deep link to the pass

### Requirement: Pass rejection notification

The resident SHALL be notified when the guard rejects an entry.

#### Scenario: Rejection
- **WHEN** a pending scan is rejected
- **THEN** a `pass_rejected` notification is created for the resident
- **THEN** it includes the visitor name and the reason

### Requirement: Vehicle entry notification

The resident SHALL be notified when a vehicle enters.

#### Scenario: Vehicle entry
- **WHEN** an entry is confirmed for a pass with `hasVehicle = true`
- **THEN** a `vehicle_entry` notification is created
- **THEN** it includes the vehicle plate

### Requirement: Missing exit notification

The system SHALL notify the resident, guard, and community admin when a pass stays
inside after its window.

#### Scenario: Alert notified
- **WHEN** the pass worker creates a `missing_exit` alert
- **THEN** a `pass_missing_exit` notification is created for the resident
- **THEN** it is also created for the guard and `community_admin` of the community
- **THEN** it includes the visitor name, unit, and due time

#### Scenario: Critical delivery
- **WHEN** `pass_missing_exit` is delivered
- **THEN** it ignores quiet hours
- **THEN** it is not suppressed by non-critical rate limits

#### Scenario: Resolved
- **WHEN** the missing exit alert is resolved
- **THEN** no new reminder is sent unless configured

### Requirement: Pass notification deduplication

Pass notifications SHALL not duplicate.

#### Scenario: Entry dedup
- **WHEN** the same pass/cycle entry is processed twice
- **THEN** only one `pass_entry` notification is created

#### Scenario: Missing exit dedup
- **WHEN** the pass worker runs again for the same pass and day
- **THEN** only one open `pass_missing_exit` notification is created

### Requirement: Pass notification preferences

Residents SHALL be able to configure pass notifications.

#### Scenario: Disable push
- **WHEN** the resident disables push for `pass_entry`
- **THEN** the notification remains in-app and no push is sent

#### Scenario: Critical cannot be disabled
- **WHEN** the resident tries to disable `pass_missing_exit` in-app
- **THEN** in-app delivery is forced on
