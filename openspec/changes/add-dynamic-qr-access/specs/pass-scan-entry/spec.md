## ADDED Requirements

### Requirement: Scan endpoint

The API SHALL expose `POST /api/access/scan` for authenticated guards.

#### Scenario: Valid scan

- **WHEN** a guard posts a QR token
- **THEN** the token is decoded and validated
- **THEN** a `pass_scan` is created with `status = 'pending'`
- **THEN** the scan records `guard_person_id`, `guard_account_id`, `shift_id`,
  `access_point_id` and `access_point_name`
- **THEN** the response contains the pass details, the `locationPath`, the action
  (`entry` or `exit`), the access point name, and a `scanId`

#### Scenario: Guard from another community

- **WHEN** the pass belongs to a community different from the guard's active community
- **THEN** the response has status 403 with reason `foreign_community`
- **THEN** a `scan_denied` bitácora entry is written

#### Scenario: Invalid or expired token

- **WHEN** the token signature is invalid or expired
- **THEN** the response has status 400 with reason `invalid_or_expired_token`
- **THEN** a `scan_denied` bitácora entry is written

#### Scenario: Replayed token

- **WHEN** the token's `jti` was already used
- **THEN** the response has status 409 with reason `token_already_used`
- **THEN** a `scan_denied` bitácora entry is written

#### Scenario: Operator

- **WHEN** an operator tries to scan
- **THEN** the response has status 403
- **THEN** the operator has no shift or bitácora

### Requirement: Shift context

Every scan SHALL happen inside an open guard shift and an access point segment.

#### Scenario: No active shift

- **WHEN** a guard without an open shift scans
- **THEN** the response has status 409 with reason `no_active_shift`

#### Scenario: Access point recorded

- **WHEN** the scan is created
- **THEN** it stores the current `shift_id`, `access_point_id` and
  `access_point_name`
- **THEN** the response includes `accessPointId`, `accessPointName` and `shiftId`

#### Scenario: Change access mid-shift

- **WHEN** the guard changes access point and scans again
- **THEN** the new scan uses the new segment's access point

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

- **WHEN** the pass is outside the allowed time window and presence is `outside`
- **THEN** the response is `denied` with reason `out_of_schedule`
- **THEN** no pass state changes
- **THEN** a `scan_denied` bitácora entry is written

#### Scenario: Revoked or expired

- **WHEN** the pass is revoked or expired
- **THEN** the response is `denied` with the corresponding reason
- **THEN** a `scan_denied` bitácora entry is written

#### Scenario: Used pass

- **WHEN** the pass status is `used`
- **THEN** the response is `denied` with reason `pass_used`
- **THEN** no pending scan is created
- **THEN** a `scan_denied` bitácora entry is written

#### Scenario: Wrong direction

- **WHEN** the access point direction is `entry` and the action is `exit`, or the reverse
- **THEN** the response is `denied` with reason `wrong_direction`
- **THEN** a `scan_denied` bitácora entry is written

### Requirement: Confirm scan

The guard SHALL confirm the entry or exit.

#### Scenario: Confirmer on shift

- **WHEN** a guard confirms a pending scan
- **THEN** the guard must have an open segment at the scan's access point
- **THEN** otherwise the response has status 403 with reason
  `not_on_shift_at_access_point`
- **THEN** the scan records `confirmed_by_person_id` and `confirmed_by_account_id`

#### Scenario: Confirm entry

- **WHEN** the guard confirms a pending entry
- **THEN** in one transaction the pass sets `presence_state = 'inside'`, `entry_at`,
  and increments `entry_count`
- **THEN** the scan becomes `confirmed`
- **THEN** a `pass.entry` event is enqueued with topic `events`
- **THEN** a `pass_entry` bitácora entry is written with the access point, pass, scan,
  visitor, vehicle, location path and authorizer
- **THEN** the response includes `bitacoraEntryId`

#### Scenario: Confirm exit

- **WHEN** the guard confirms a pending exit
- **THEN** the pass sets `presence_state = 'outside'`, `exit_at`, and increments
  `exit_count`
- **THEN** a `pass.exit` event is enqueued with topic `events`
- **THEN** an open missing-exit alert, if any, is resolved
- **THEN** a `pass_exit` bitácora entry is written
- **THEN** the response includes `bitacoraEntryId`

#### Scenario: Entry only consumed

- **WHEN** the pass is `entry_only` and the entry is confirmed
- **THEN** the pass becomes `used`

#### Scenario: Entry/exit completed

- **WHEN** the pass is `entry_exit` and the exit is confirmed
- **THEN** the pass becomes `used`

#### Scenario: Confirmation after expiry

- **WHEN** the guard confirms a scan after `PASS_SCAN_PENDING_TTL_SECONDS` (120 s)
- **THEN** the response has status 409 with reason `scan_expired`
- **THEN** the scan becomes `expired`

#### Scenario: Confirmation after pass expiry

- **WHEN** the guard confirms after the pass expired but the scan was created while valid
- **THEN** the confirmation is rejected with status 409

### Requirement: Reject scan

The guard SHALL be able to reject the access.

#### Scenario: Reject

- **WHEN** the guard rejects a pending scan
- **THEN** the scan becomes `rejected`
- **THEN** the pass state does not change
- **THEN** a `pass.rejected` event is enqueued with topic `events`
- **THEN** a `pass_rejected` bitácora entry is written with the reason
- **THEN** the response includes `bitacoraEntryId`

#### Scenario: Reject a consumed token

- **WHEN** the scan was already confirmed, rejected, or expired
- **THEN** the response has status 409

### Requirement: Scan audit

Every closed scan SHALL be recorded in the bitácora.

#### Scenario: Audit fields

- **WHEN** a scan is confirmed or rejected
- **THEN** it records `pass_id`, `guard_person_id`, `guard_account_id`, `shift_id`,
  `access_point_id`, `access_point_name`, `community_id`, `location_unit_id`,
  `structure_id`, visitor first name, last name, document, vehicle plate, action,
  result, reason, `token_jti`, `scanned_at`, and `confirmed_at`

#### Scenario: Authorizer

- **WHEN** the guard views the scan result
- **THEN** the response includes the resident's name who authorized the pass
- **THEN** the response includes `locationPath` and the access point name

#### Scenario: Guard history

- **WHEN** a guard lists their scans
- **THEN** the response is paginated and ordered by `scanned_at DESC`

### Requirement: Concurrent scans

The system SHALL prevent double confirmation.

#### Scenario: Two guards confirm at the same time

- **WHEN** two confirmations race for the same pending scan
- **THEN** only one succeeds
- **THEN** the other receives status 409
