## ADDED Requirements

### Requirement: Verify endpoint

The API SHALL expose `POST /api/internal/access/verify` to evaluate an access attempt.

#### Scenario: Verify an access attempt

- **WHEN** a device posts `{ requestId, deviceId, communityId, accessPointId,
  credential, direction, timestamp }`
- **THEN** the engine loads the credential, rules, and policy
- **THEN** it returns `{ decision, reason, matchedRuleId, credentialId, subject,
  requestId }`

#### Scenario: Missing required fields

- **WHEN** the request omits `deviceId`, `accessPointId`, or `credential`
- **THEN** the response has status 400 with validation details

#### Scenario: Unknown community or access point

- **WHEN** `communityId` or `accessPointId` does not exist
- **THEN** the response has status 404

### Requirement: Decision outcomes

The engine SHALL return exactly one of `allow` or `deny` with a machine-readable
reason.

#### Scenario: Allowed access

- **WHEN** an explicit allow rule matches and no deny rule applies
- **THEN** the decision is `allow` with reason `allowed`
- **THEN** the response includes `matchedRuleId`

#### Scenario: Denied access

- **WHEN** the credential is invalid, expired, revoked, out of schedule, over max uses,
  or blocked by anti-passback
- **THEN** the decision is `deny` with a specific reason such as `invalid_token`,
  `expired`, `revoked`, `out_of_schedule`, `max_uses_reached`, or `anti_passback`

#### Scenario: Unknown credential

- **WHEN** the credential cannot be resolved
- **THEN** the decision is `deny` with reason `unknown_credential`
- **THEN** the response does not reveal whether the credential ever existed

### Requirement: Device authentication

The verify endpoint SHALL authenticate the calling device.

#### Scenario: Valid device token

- **WHEN** the request includes a valid device token for the same community
- **THEN** the request is processed

#### Scenario: Missing or invalid device token

- **WHEN** the request has no device token or an invalid one
- **THEN** the response has status 401

#### Scenario: Device from another community

- **WHEN** the device token belongs to a different community than `communityId`
- **THEN** the response has status 403

### Requirement: Idempotent verification

The engine SHALL deduplicate retries using `requestId`.

#### Scenario: Duplicate request

- **WHEN** the same `requestId` is received again for the same device within the
  idempotency window
- **THEN** the previously computed decision is returned
- **THEN** no second actuation or usage increment occurs

#### Scenario: Different request with same id

- **WHEN** the same `requestId` is reused with a different payload
- **THEN** the response has status 409

### Requirement: Actuation

On an `allow` decision, the engine SHALL request actuation through the `Actuator`
interface.

#### Scenario: Successful actuation

- **WHEN** the decision is `allow`
- **THEN** the engine sends an actuation command with the same `requestId`
- **THEN** it records `access.granted` and the actuation result

#### Scenario: Actuation failure

- **WHEN** the actuation command fails or times out
- **THEN** the engine records `access.actuation_failed`
- **THEN** the response includes `decision = 'allow'` and `actuated = false` so the
  device can apply its local fallback

#### Scenario: Deny never actuates

- **WHEN** the decision is `deny`
- **THEN** no actuation command is sent
- **THEN** the denial is recorded

### Requirement: Decision caching and rate limiting

The engine SHALL protect itself from abusive or misconfigured devices.

#### Scenario: Rate limit exceeded

- **WHEN** a device exceeds the configured verifications per minute
- **THEN** further requests receive status 429

#### Scenario: Rule set version

- **WHEN** rules change for a community
- **THEN** the community's rule set version is incremented
- **THEN** the response includes the current `rulesVersion`
