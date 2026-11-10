## ADDED Requirements

### Requirement: First-device binding

The public pass link SHALL bind to the first device that opens it.

#### Scenario: First open

- **WHEN** an unbound pass link is opened
- **THEN** the server issues a signed `pass_device` cookie for that pass
- **THEN** the cookie is HttpOnly, `Secure` in production, `SameSite=Lax`, and
  `Path=/api/public/passes`
- **THEN** the cookie `Max-Age` matches the link TTL
- **THEN** the pass stores a hash of the device key and `bound_at`

#### Scenario: Same device returns

- **WHEN** the same device opens the link again with the cookie
- **THEN** the cookie matches and the link is usable

#### Scenario: Different device

- **WHEN** a pass already bound to one device is opened on another device
- **THEN** the response has status 403
- **THEN** the link does not reveal the visitor's data

#### Scenario: Lost device

- **WHEN** the resident regenerates the link
- **THEN** the old device binding is cleared
- **THEN** the next device that opens the new link becomes the bound device

### Requirement: Link expiration

The public link SHALL expire after its configured TTL.

#### Scenario: Expired link

- **WHEN** the link is opened after `link_expires_at`
- **THEN** the response has status 410 with reason `link_expired`
- **THEN** no device is bound

#### Scenario: TTL capped by validity

- **WHEN** the link is created
- **THEN** `link_expires_at` is the earlier of the configured TTL and `validUntil`

### Requirement: Optional PIN before binding

A pass with a PIN SHALL require it before binding.

#### Scenario: Correct PIN

- **WHEN** the visitor enters the correct 4-digit PIN
- **THEN** the device is bound
- **THEN** the failed attempt counter is reset

#### Scenario: Wrong PIN

- **WHEN** the visitor enters an incorrect PIN
- **THEN** the response has status 403
- **THEN** `pin_failed_attempts` is incremented
- **THEN** after `PASS_PIN_ATTEMPTS` failures the PIN is locked for
  `PASS_PIN_LOCK_MINUTES`

#### Scenario: Locked PIN

- **WHEN** the visitor tries the PIN while `pin_locked_until` is in the future
- **THEN** the response has status 429 with reason `pin_locked`

#### Scenario: PIN not set

- **WHEN** the pass has no PIN
- **THEN** the first open binds the device without asking for a PIN

### Requirement: Public pass preview

The public link SHALL expose a minimal preview before binding.

#### Scenario: Preview

- **WHEN** a valid link is opened
- **THEN** the response includes community name, visitor first name, masked document,
  `locationPath`, validity window, and vehicle plate if present
- **THEN** `locationPath` includes the structure, level, and unit labels
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
