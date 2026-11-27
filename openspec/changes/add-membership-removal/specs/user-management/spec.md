## ADDED Requirements

### Requirement: Remove a membership

The API SHALL allow an authorized admin to delete a membership permanently, while the
person, the account and the historical records are preserved.

#### Scenario: Delete an inactive membership

- **WHEN** an admin deletes a membership of their scope with `status = 'inactive'`
- **THEN** the row is removed
- **THEN** the response has status 200 with `{ deleted: true }`
- **THEN** a `membership.deleted` event is recorded with person, role and community

#### Scenario: Delete an active membership

- **WHEN** an admin deletes an active membership of their scope
- **THEN** the row is removed
- **THEN** the user can no longer obtain a token for that context

#### Scenario: Person and history survive

- **WHEN** the membership is deleted
- **THEN** the person, the account, the bitácora and the passes of that person remain

#### Scenario: Role policy applies

- **WHEN** a `community_admin` deletes a membership of their community whose role they
  cannot assign
- **THEN** the response has status 403

#### Scenario: Organization admin cleans a stale organization admin

- **WHEN** an `org_admin` deletes another active `org_admin` membership and at least one
  other active `org_admin` remains in the organization
- **THEN** the row is removed
- **THEN** the organization keeps at least one active administrator

#### Scenario: Last organization admin

- **WHEN** an admin deletes the only active `org_admin` membership of an organization
- **THEN** the response has status 409 with code `last_org_admin`

#### Scenario: Own active membership

- **WHEN** an admin deletes the membership that is their own active context
- **THEN** the response has status 409 with code `own_active_membership`

#### Scenario: Open shift

- **WHEN** the person of the membership has an open shift in that community
- **THEN** the response has status 409 with code `open_shift`
- **THEN** the admin can force-close the shift and retry

#### Scenario: Out of scope or missing

- **WHEN** the membership does not exist or is outside the actor scope
- **THEN** the response has status 404

#### Scenario: Platform administrator

- **WHEN** a platform administrator calls the delete endpoint
- **THEN** the response has status 403
- **THEN** the membership is not removed
