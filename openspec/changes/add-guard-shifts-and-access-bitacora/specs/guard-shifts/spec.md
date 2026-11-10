## ADDED Requirements

### Requirement: Personal guard shift

The system SHALL model a guard shift as a personal work session with a start, an end and
one or more access point segments.

#### Scenario: Start a shift

- **WHEN** a guard starts a shift
- **THEN** a `guard_shift` is created with `guard_person_id`, `guard_account_id`,
  `community_id`, `status = 'open'` and `started_at`
- **THEN** an initial `guard_shift_segment` is created with the selected access point
- **THEN** a `shift_start` bitácora entry is written for that access point

#### Scenario: Start is idempotent

- **WHEN** a guard with an open shift starts a shift again
- **THEN** the existing open shift and its current segment are returned
- **THEN** no duplicate shift is created

#### Scenario: End a shift

- **WHEN** the guard ends their open shift
- **THEN** the open segment is closed with `end_reason = 'shift_end'`
- **THEN** the shift is closed with `status = 'closed'` and `ended_at`
- **THEN** a `shift_end` bitácora entry is written for the current access point

#### Scenario: Shift belongs to the guard

- **WHEN** a guard tries to end or change another guard's shift
- **THEN** the response has status 403

### Requirement: Multiple guards per access point

The system SHALL allow two or more guards to have open shifts at the same access point.

#### Scenario: Overlapping shifts

- **WHEN** a second guard starts a shift at an access point that already has an open shift
- **THEN** the second shift is created
- **THEN** both guards appear as active at that access point

#### Scenario: One open shift per guard

- **WHEN** a guard already has an open shift
- **THEN** the database rejects a second open shift for the same `guard_person_id`

### Requirement: Access point change during a shift

The system SHALL allow a guard to change the access point without ending the shift.

#### Scenario: Change access point

- **WHEN** the guard changes to another active access point of the same community
- **THEN** the current segment is closed with `end_reason = 'reassigned'`
- **THEN** a new segment is opened with the new access point
- **THEN** a `shift_end` entry is written at the old access point with reason
  `reassigned`
- **THEN** a `shift_start` entry is written at the new access point with reason
  `reassigned`

#### Scenario: Same access point

- **WHEN** the guard selects the access point they are already covering
- **THEN** the response returns the current segment
- **THEN** no new segment or bitácora entry is created

#### Scenario: Foreign access point

- **WHEN** the guard selects an access point from another community or an inactive one
- **THEN** the response has status 403 or 400

### Requirement: Default access point

The system SHALL let the community admin assign a default access point to a guard
membership.

#### Scenario: Start with default

- **WHEN** a guard with `default_access_point_id` starts a shift without choosing a gate
- **THEN** the shift starts at the default access point

#### Scenario: No default

- **WHEN** a guard without `default_access_point_id` starts a shift
- **THEN** the request must include an active access point of the guard's community
- **THEN** otherwise the response has status 400

#### Scenario: Default out of scope

- **WHEN** the default access point belongs to another community or is inactive
- **THEN** the guard must choose another active access point

### Requirement: Shift history

The system SHALL expose the guard's shift history and, to admins, the active shifts per
community and access point.

#### Scenario: Guard history

- **WHEN** a guard lists their shifts
- **THEN** the response is paginated and ordered by `started_at DESC`
- **THEN** each item includes the access point segments and duration

#### Scenario: Admin active guards

- **WHEN** a community admin lists open shifts for an access point
- **THEN** the response includes every guard with an open segment at that place

### Requirement: Shift closure by admin

The system SHALL let community and organization admins force-close a stale shift.

#### Scenario: Force close

- **WHEN** an admin force-closes a shift with a reason
- **THEN** the open segment and the shift are closed with `end_reason = 'forced'`
- **THEN** a `shift_end` bitácora entry is written with the admin as author and source
  `dashboard`

#### Scenario: Stale shift

- **WHEN** an open shift exceeds `GUARD_SHIFT_MAX_HOURS`
- **THEN** the current-shift response marks it as `stale`
- **THEN** the shift is not closed automatically
