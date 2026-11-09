## ADDED Requirements

### Requirement: Scan endpoint

The API SHALL expose `POST /api/access/scan` for authenticated guards and operators.

#### Scenario: Valid scan
- **WHEN** a guard posts a QR token
- **THEN** the token is decoded and validated
- **THEN** a `pass_scan` is created with `status = 'pending'`
- **THEN** the response contains the pass details, the action (`entry` or `exit`), and a
  `scanId`

#### Scenario: Guard from another community
- **WHEN** the pass belongs to a community different from the guard's active community
- **THEN** the response has status 403

#### Scenario: Invalid or expired token
- **WHEN** the token signature is invalid or expired
- **THEN** the response has status 400 with reason `invalid_or_expired_token`

#### Scenario: Replayed token
- **WHEN** the token's `jti` was already used
- **THEN** the response has status 409 with reason `token_already_used`

### Requirement: Authorization result

The scan SHALL authorize only active passes within their schedule.

#### Scenario: Authorized entry
- **WHEN** the pass is active, outside presence, and within the allowed schedule
- **THEN** the response is `authorized` with action `entry`

#### Scenario: Authorized exit
- **WHEN** the pass is active and presence is `inside`
- **THEN** the response is `authorized` with action `exit`
- **THEN** the exit is allowed even after the daily window ended

#### Scenario: Outside schedule
- **WHEN** the pass is outside the allowed days/time and presence is `outside`
- **THEN** the response is `denied` with reason `out_of_schedule`
- **THEN** no pass state changes

#### Scenario: Revoked or expired
- **WHEN** the pass is revoked or expired
- **THEN** the response is `denied` with the corresponding reason

### Requirement: Confirm scan

The guard SHALL confirm the entry or exit.

#### Scenario: Confirm entry
- **WHEN** the guard confirms a pending entry
- **THEN** in one transaction the pass sets `presence_state = 'inside'`, `entry_at`,
  and increments `entry_count`
- **THEN** the scan becomes `confirmed`
- **THEN** an entry notification is enqueued for the resident

#### Scenario: Confirm exit
- **WHEN** the guard confirms a pending exit
- **THEN** the pass sets `presence_state = 'outside'`, `exit_at`, and increments
  `exit_count`
- **THEN** an exit notification is enqueued
- **THEN** an open missing-exit alert is resolved

#### Scenario: Entry only consumed
- **WHEN** the pass is `entry_only` and the entry is confirmed
- **THEN** the pass becomes `used`

#### Scenario: Entry/exit completed
- **WHEN** the pass is `entry_exit` and the exit is confirmed
- **THEN** the pass becomes `used`

#### Scenario: Recurring stays active
- **WHEN** the pass is `entry_exit_recurring` and the exit is confirmed
- **THEN** the pass remains `active` and `outside`

#### Scenario: Confirmation after expiry
- **WHEN** the guard confirms after the pass expired but the scan was created while valid
- **THEN** the confirmation is rejected with status 409

### Requirement: Reject scan

The guard SHALL be able to reject the access.

#### Scenario: Reject
- **WHEN** the guard rejects a pending scan
- **THEN** the scan becomes `rejected`
- **THEN** the pass state does not change
- **THEN** a rejection notification is enqueued for the resident

#### Scenario: Reject a consumed token
- **WHEN** the scan was already confirmed or rejected
- **THEN** the response has status 409

### Requirement: Scan audit

Every scan SHALL be recorded in the bitácora.

#### Scenario: Audit fields
- **WHEN** a scan is created or confirmed
- **THEN** it records `pass_id`, `guard_id`, `community_id`, `unit_id`, visitor first
  name, last name, document, vehicle plate, action, result, reason, `token_jti`,
  `scanned_at`, and `confirmed_at`

#### Scenario: Authorizer
- **WHEN** the guard views the scan result
- **THEN** the response includes the resident's name who authorized the pass

#### Scenario: Guard history
- **WHEN** a guard lists their scans
- **THEN** the response is paginated and ordered by `scanned_at DESC`

### Requirement: Concurrent scans

The system SHALL prevent double confirmation.

#### Scenario: Two guards confirm at the same time
- **WHEN** two confirmations race for the same pending scan
- **THEN** only one succeeds
- **THEN** the other receives status 409
