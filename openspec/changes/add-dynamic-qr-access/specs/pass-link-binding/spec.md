## ADDED Requirements

### Requirement: First-device binding

The public pass link SHALL bind to the first device that opens it.

#### Scenario: First open
- **WHEN** an unbound pass link is opened
- **THEN** the server issues a signed HttpOnly device cookie for that pass
- **THEN** the pass stores a hash of the device key and `bound_at`

#### Scenario: Same device returns
- **WHEN** the same device opens the link again
- **THEN** the cookie matches and the link is usable

#### Scenario: Different device
- **WHEN** a pass already bound to one device is opened on another device
- **THEN** the response has status 403
- **THEN** the link does not reveal the visitor's data

#### Scenario: Lost device
- **WHEN** the resident regenerates the link
- **THEN** the old device binding is cleared
- **THEN** the next device that opens the new link becomes the bound device

### Requirement: Optional PIN before binding

A pass with a PIN SHALL require it before binding.

#### Scenario: Correct PIN
- **WHEN** the visitor enters the correct 4-digit PIN
- **THEN** the device is bound

#### Scenario: Wrong PIN
- **WHEN** the visitor enters an incorrect PIN
- **THEN** the response has status 403
- **THEN** the attempt is rate-limited after repeated failures

#### Scenario: PIN not set
- **WHEN** the pass has no PIN
- **THEN** the first open binds the device without asking for a PIN

### Requirement: Public pass preview

The public link SHALL expose a minimal preview before binding.

#### Scenario: Preview
- **WHEN** a valid link is opened
- **THEN** the response includes community name, visitor first name, masked document,
  unit code, validity window, and vehicle plate if present
- **THEN** it does not include the full document or the resident's data

#### Scenario: Invalid link
- **WHEN** the token is unknown, revoked, or expired
- **THEN** the response has status 404 or 410 with a generic message

### Requirement: Status endpoint

The public link SHALL expose the pass status for the bound device.

#### Scenario: Active
- **WHEN** the bound device requests the status
- **THEN** the response includes `status`, `presenceState`, and the next valid window if
  outside the schedule

#### Scenario: Used
- **WHEN** the pass is used
- **THEN** the response returns `used` and the page stops refreshing the QR

#### Scenario: Inside
- **WHEN** an entry/exit pass is inside
- **THEN** the response returns `inside` so the page can show that the next scan
  registers the exit

### Requirement: Rate limiting

The system SHALL rate-limit binding and status requests.

#### Scenario: Excessive bind attempts
- **WHEN** an IP or token exceeds the configured bind attempts per minute
- **THEN** the response has status 429
