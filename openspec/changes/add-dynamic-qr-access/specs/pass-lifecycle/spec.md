## ADDED Requirements

### Requirement: Pass status

A pass SHALL have a status and, for entry/exit types, a presence state.

#### Scenario: Status values
- **WHEN** a pass is inspected
- **THEN** `status` is one of `active`, `used`, `revoked`, `expired`
- **THEN** `presence_state` is one of `outside`, `inside`

#### Scenario: New pass
- **WHEN** a pass is created
- **THEN** `status = 'active'` and `presence_state = 'outside'`

#### Scenario: Entry only consumed
- **WHEN** an `entry_only` entry is confirmed
- **THEN** `status = 'used'`

#### Scenario: Entry/exit consumed
- **WHEN** an `entry_exit` exit is confirmed
- **THEN** `status = 'used'`

### Requirement: Expiration

Passes SHALL expire automatically after `validUntil`.

#### Scenario: Expired pass
- **WHEN** the current time is after `validUntil`
- **THEN** the pass is considered `expired`
- **THEN** the link and QR are rejected

#### Scenario: Inside on expiry
- **WHEN** an entry/exit pass is `inside` when `validUntil` is reached
- **THEN** the exit is still allowed
- **THEN** the missing-exit alert applies

### Requirement: Recurring passes

Recurring passes SHALL be usable on allowed days and windows until `validUntil`.

#### Scenario: Next allowed day
- **WHEN** a recurring pass exits and the next allowed day starts
- **THEN** it can enter again

#### Scenario: Outside allowed days
- **WHEN** a recurring pass is scanned on a day not allowed
- **THEN** entry is denied

### Requirement: Revocation

Revoking a pass SHALL invalidate the link and QR immediately.

#### Scenario: Revoke active
- **WHEN** the resident or an admin revokes an active pass
- **THEN** `status = 'revoked'`
- **THEN** the public link returns 410 and the QR endpoint is rejected

### Requirement: Missing exit alert

The system SHALL alert when an entry/exit pass remains inside after its window.

#### Scenario: Alert created
- **WHEN** a pass with a schedule is `inside` after the daily window plus the configured
  grace period (15 minutes by default)
- **THEN** a `pass_alert` of type `missing_exit` is created
- **THEN** a notification request is enqueued for the resident, guard, and
  `community_admin`

#### Scenario: No duplicate alerts
- **WHEN** the worker runs again for the same pass and day
- **THEN** it does not create a second open alert

#### Scenario: Alert resolved by exit
- **WHEN** the exit is confirmed
- **THEN** the open alert becomes `resolved`

#### Scenario: Manual resolution
- **WHEN** an admin resolves the alert manually
- **THEN** the alert becomes `resolved` and the resolution is audited

### Requirement: Audit events

Every lifecycle change SHALL be persisted as an event.

#### Scenario: Event types
- **WHEN** a pass is created, linked, scanned, confirmed, rejected, revoked, or expires
- **THEN** an event with topic `events` is enqueued in the outbox

#### Scenario: Notification requests
- **WHEN** a resident must be notified
- **THEN** a `notification.requested` event with topic `notifications` is enqueued in the
  same transaction as the pass change

#### Scenario: No sensitive token
- **WHEN** an event is recorded
- **THEN** it does not contain the raw link token or QR token
