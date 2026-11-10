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
- **THEN** the missing-exit alert is evaluated only when Phase 2 is enabled

### Requirement: Recurring passes (Phase 2)

Recurring passes SHALL be usable on allowed days and windows until `validUntil`.

#### Scenario: Reserved behavior

- **WHEN** the MVP runs
- **THEN** recurring passes cannot be created
- **THEN** the enum and `allowed_days`, `time_from`, `time_to` columns are reserved for
  Phase 2

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

### Requirement: Missing exit alert (Phase 2)

The system SHALL alert when an entry/exit pass remains inside after its window.

#### Scenario: Reserved in MVP

- **WHEN** the MVP runs
- **THEN** the missing-exit worker is disabled
- **THEN** `PASS_MISSING_EXIT_GRACE_MINUTES` is read but no alert is created

#### Scenario: Alert created

- **WHEN** Phase 2 is enabled and a pass is `inside` after the window plus the configured
  grace period (15 minutes by default)
- **THEN** a `pass_alert` of type `missing_exit` is created
- **THEN** a `notification.requested` event is enqueued

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

- **WHEN** a pass is created, scanned, confirmed, rejected, or revoked
- **THEN** an event with topic `events` is enqueued in the outbox

#### Scenario: Expiration event (Phase 2)

- **WHEN** the expiration worker runs in Phase 2
- **THEN** it enqueues an expiration event with topic `events`

#### Scenario: Notification requests (Phase 2)

- **WHEN** Phase 2 notifications are enabled and a resident must be notified
- **THEN** a `notification.requested` event with topic `notifications` is enqueued in the
  same transaction as the pass change

#### Scenario: No sensitive token

- **WHEN** an event is recorded
- **THEN** it does not contain the raw link token or QR token

### Requirement: Access bitácora entries

Confirmed, rejected and denied scans SHALL produce immutable bitácora entries.

#### Scenario: Confirmed entry and exit

- **WHEN** an entry or exit is confirmed
- **THEN** a `pass_entry` or `pass_exit` entry is written to `bitacora_entries`
- **THEN** the entry stores the access point, shift, author, visitor snapshot and
  authorizer

#### Scenario: Rejected scan

- **WHEN** a guard rejects a pending scan
- **THEN** a `pass_rejected` entry is written with the reason
- **THEN** the pass state does not change

#### Scenario: Denied scan

- **WHEN** a scan is denied by policy or token validation
- **THEN** a `scan_denied` entry is written with the reason
- **THEN** no `pass_scan` row is created for the denial

#### Scenario: No raw tokens

- **WHEN** a bitácora entry is written
- **THEN** it does not contain the raw link token or QR token
- **THEN** the `jti` may be stored in `details`
