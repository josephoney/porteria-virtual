## ADDED Requirements

### Requirement: Pass revocation

Authorized users SHALL be able to revoke an active pass.

#### Scenario: Creator revokes
- **WHEN** the creator revokes an active pass
- **THEN** the pass becomes `revoked`
- **THEN** its credential becomes `revoked`
- **THEN** the revocation is included in the policy delta

#### Scenario: Admin revokes
- **WHEN** a `community_admin` revokes any pass in their community
- **THEN** the revocation is applied and audited

#### Scenario: Revoke out of scope
- **WHEN** a user revokes a pass outside their scope
- **THEN** the response has status 404

#### Scenario: Revocation is immediate online
- **WHEN** a revoked pass is scanned online
- **THEN** the decision is `deny` with reason `revoked`

### Requirement: Expiration and usage

Passes SHALL expire automatically and track usage.

#### Scenario: Auto-expire
- **WHEN** the current time passes `validUntil`
- **THEN** the pass is considered `expired` without manual action

#### Scenario: Single-use pass
- **WHEN** `maxUses = 1` and the pass is used once
- **THEN** the pass is marked `used` or `expired` according to policy

#### Scenario: Multi-use pass
- **WHEN** `maxUses > 1`
- **THEN** each valid use increments `usedCount`
- **THEN** the pass remains active until the limit or expiration

#### Scenario: Atomic usage
- **WHEN** two scans of a single-use pass arrive concurrently
- **THEN** only one succeeds

### Requirement: Pass listing and detail

The API SHALL expose pass listing and detail scoped to the caller.

#### Scenario: Resident lists own passes
- **WHEN** a resident requests their passes
- **THEN** only passes for their units are returned

#### Scenario: Guard lists community passes
- **WHEN** a guard requests passes with a date filter
- **THEN** passes of their community are returned

#### Scenario: Admin filters
- **WHEN** an admin filters by `status`, `type`, `unitId`, or date range
- **THEN** the response is paginated and filtered

#### Scenario: Pass detail
- **WHEN** an authorized user requests a pass
- **THEN** the response includes metadata, usage count, and status
- **THEN** it does not include the signed token

### Requirement: Pass audit

Every pass lifecycle change SHALL be audited.

#### Scenario: Creation audit
- **WHEN** a pass is created
- **THEN** `pass.created` is recorded with creator, unit, and type

#### Scenario: Use audit
- **WHEN** a pass is used
- **THEN** `pass.used` is recorded with access point and result

#### Scenario: Revocation audit
- **WHEN** a pass is revoked
- **THEN** `pass.revoked` is recorded with the actor and reason

#### Scenario: Audit contents
- **WHEN** a pass event is recorded
- **THEN** it contains no raw token and no sensitive holder data beyond ids
