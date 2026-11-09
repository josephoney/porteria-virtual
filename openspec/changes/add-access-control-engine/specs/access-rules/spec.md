## ADDED Requirements

### Requirement: Access rules table

The system SHALL have an `access_rules` table defining who can pass, where, when, and
under which constraints.

#### Scenario: Create rule

- **WHEN** a rule is created with `community_id`, `access_point_id?`, `subject_scope`,
  `effect`, `schedule`, and optional date range
- **THEN** the row is persisted with an auto-generated UUID and timestamps

#### Scenario: Rule scope

- **WHEN** a rule is created
- **THEN** `subject_scope` is one of `user`, `role`, `unit`, `visitor`, `vehicle`,
  `community`
- **THEN** `effect` is `allow` or `deny`

#### Scenario: Optional access point

- **WHEN** `access_point_id` is null
- **THEN** the rule applies to every access point of the community

### Requirement: Deny-by-default and deny-wins

The engine SHALL deny access unless an explicit allow rule matches, and any matching
deny rule SHALL win.

#### Scenario: No matching rule

- **WHEN** no rule matches the request
- **THEN** the decision is `deny` with reason `no_matching_rule`

#### Scenario: Deny overrides allow

- **WHEN** an allow rule and a deny rule both match
- **THEN** the decision is `deny` with reason `denied_by_rule`
- **THEN** the deny rule is reported as `matchedRuleId`

#### Scenario: Most specific allow wins

- **WHEN** multiple allow rules match
- **THEN** the most specific rule is reported (unit+user > user > role > community)

### Requirement: Schedule evaluation

Rules SHALL support weekly schedules evaluated in the community's timezone.

#### Scenario: Inside schedule

- **WHEN** the local time of the community is within the rule's weekly window
- **THEN** the rule matches

#### Scenario: Outside schedule

- **WHEN** the local time is outside the rule's window
- **THEN** the rule does not match

#### Scenario: Date range

- **WHEN** the request time is outside the rule's `valid_from`/`valid_until`
- **THEN** the rule does not match

#### Scenario: Timezone

- **WHEN** a rule is configured for 08:00–18:00 in `America/Bogota`
- **THEN** evaluation converts the request timestamp to `America/Bogota` before
  comparing

### Requirement: Max uses and anti-passback

Rules SHALL support usage limits and directional anti-passback.

#### Scenario: Max uses per rule

- **WHEN** a rule has `max_uses = 3` and the credential already used it 3 times
- **THEN** the rule no longer matches

#### Scenario: Anti-passback enabled

- **WHEN** anti-passback is enabled for a point
- **AND** the same subject entered without a matching exit
- **THEN** a second entry is denied with reason `anti_passback`

#### Scenario: Anti-passback disabled

- **WHEN** anti-passback is disabled for a point
- **THEN** repeated entries are not blocked by this control

### Requirement: Access point fail policy

Each access point SHALL define what happens when it cannot reach the server.

#### Scenario: Fail-closed

- **WHEN** an access point has `fail_policy = 'closed'` and cannot reach the server
- **THEN** it denies access unless a valid offline policy allows it

#### Scenario: Fail-open

- **WHEN** an access point has `fail_policy = 'open'` and cannot reach the server
- **THEN** it opens the barrier and records an auditable emergency event

#### Scenario: Default policy

- **WHEN** an access point is created without a policy
- **THEN** `fail_policy` defaults to `closed`
- **THEN** `direction` defaults to `both`

### Requirement: Rule simulation

The API SHALL provide a dry-run evaluation that never actuates or logs a real access.

#### Scenario: Simulate decision

- **WHEN** an admin requests a simulation with subject, credential, access point, and
  timestamp
- **THEN** the response contains the would-be decision, `matchedRuleId`, and reason
- **THEN** no actuation is triggered
- **THEN** the simulation is marked as `dry_run` in audit
