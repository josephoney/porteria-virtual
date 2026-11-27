## ADDED Requirements

### Requirement: Workstation assignment resource

The API SHALL expose the workstation assigned to a guard membership, and the assignment
SHALL be the only source of the guard's default access point.

#### Scenario: Assign a workstation
- **WHEN** an authorized admin sends `PUT /api/memberships/:id/workstation` with the
  `accessPointId` of an active access point of the membership community
- **THEN** `memberships.default_access_point_id` stores that access point
- **THEN** the response has status 200 with the membership id and the access point
  (`id`, `name`, `type`, `direction`, `active`)

#### Scenario: Reassign replaces the previous workstation
- **WHEN** a membership already has a workstation and a different `accessPointId` is sent
- **THEN** the new access point replaces the previous one
- **THEN** the membership keeps a single workstation

#### Scenario: Unassign
- **WHEN** the request sends `accessPointId = null`
- **THEN** the column is cleared
- **THEN** the response has status 200 with `accessPointId = null`

#### Scenario: Unassign is idempotent
- **WHEN** `accessPointId = null` is sent for a membership without a workstation
- **THEN** the response has status 200
- **THEN** no change event is recorded

#### Scenario: Read own workstation
- **WHEN** a `guard` requests `GET /api/me/workstation`
- **THEN** the response contains `accessPointId`, `name`, `type`, `direction`, `active`
  and the membership `communityId`

#### Scenario: No workstation yet
- **WHEN** a guard without a workstation requests `GET /api/me/workstation`
- **THEN** the response has status 200 with `accessPointId = null`
- **THEN** the empty state is not an error

#### Scenario: Non-guard reads their workstation
- **WHEN** an authenticated user without a guard membership requests
  `GET /api/me/workstation`
- **THEN** the response has status 200 with `accessPointId = null`

#### Scenario: Guards assigned to an access point
- **WHEN** an admin requests
  `GET /api/communities/:id/access-points/:accessPointId/guards`
- **THEN** the response lists every active guard membership assigned to that access point
- **THEN** each item includes the person name, the membership id, `onShift` and `shiftId`
- **THEN** memberships assigned to another access point are not included

### Requirement: Workstation assignment restrictions

The system SHALL reject workstation assignments that violate the role or the scope of the
membership.

#### Scenario: Role is not guard
- **WHEN** a workstation is assigned to a membership with role `resident`, `tenant`,
  `owner`, `operator`, `community_admin`, `org_admin` or `staff`
- **THEN** the response has status 400 with code `role_not_guard`

#### Scenario: Membership without community
- **WHEN** the membership has no `communityId`
- **THEN** the response has status 400 with code `membership_requires_community`

#### Scenario: Access point from another community
- **WHEN** the `accessPointId` belongs to a community different from the membership
- **THEN** the response has status 404

#### Scenario: Inactive access point
- **WHEN** the `accessPointId` is inactive
- **THEN** the response has status 400 with code `access_point_inactive`

#### Scenario: Actor outside the community
- **WHEN** a `community_admin` assigns a workstation for a membership of another community
- **THEN** the response has status 403 or 404

#### Scenario: Platform administrator
- **WHEN** a platform administrator calls the assignment endpoint
- **THEN** the response has status 403 with the tenant read-only reason
- **THEN** the workstation is not changed

#### Scenario: Guard cannot assign themselves
- **WHEN** a `guard` calls the assignment endpoint
- **THEN** the response has status 403

#### Scenario: Membership not found or out of scope
- **WHEN** the membership id does not exist or is outside the actor scope
- **THEN** the response has status 404

### Requirement: Assignment is advisory

The assignment SHALL act as the guard's default access point and as visibility for
administrators, and SHALL NOT restrict the access points where a guard may start a shift.

#### Scenario: Guard starts a shift at another active gate
- **WHEN** a guard assigned to access point A starts a shift at access point B, both active
  and of their community
- **THEN** the shift starts at B
- **THEN** the assignment stays at A

#### Scenario: No administrator action is required to cover another gate
- **WHEN** a guard starts a shift at a gate they are not assigned to
- **THEN** the system does not require an assignment or an exception beforehand
- **THEN** the bitácora records the gate actually covered

### Requirement: Assignment and open shifts

A workstation change SHALL NOT move an open shift.

#### Scenario: Assignment while a shift is open
- **WHEN** the guard has an open shift at access point A and the admin assigns access
  point B
- **THEN** the response has status 200 with `appliesNextShift = true`
- **THEN** the response includes `activeShiftAccessPointId = A`
- **THEN** the open segment stays at A
- **THEN** no bitácora entry is written for the change

#### Scenario: Next shift uses the new workstation
- **WHEN** the guard closes the shift and starts a new one without choosing a gate
- **THEN** the new shift starts at the newly assigned access point

#### Scenario: Guard changes gate during a shift
- **WHEN** the guard uses the existing change-access-point action
- **THEN** the behavior is unchanged
- **THEN** the assigned workstation is not modified

### Requirement: Workstation assignment audit

Every workstation change SHALL be audited.

#### Scenario: Assign or replace event
- **WHEN** a workstation is assigned or replaced
- **THEN** an `admin.workstation.assigned` event is recorded with actor, membership,
  community, previous access point and new access point

#### Scenario: Unassign event
- **WHEN** a workstation is cleared
- **THEN** an `admin.workstation.unassigned` event is recorded with the previous access
  point

#### Scenario: Compatibility path audits the same way
- **WHEN** the workstation is changed through `PATCH /api/memberships/:id`
- **THEN** the same events are recorded with the same metadata

#### Scenario: No sensitive payload
- **WHEN** the event is recorded
- **THEN** it contains no passwords, tokens or personal documents

### Requirement: Inactive assigned workstation

The system SHALL preserve an assignment whose access point is deactivated.

#### Scenario: Deactivated access point keeps the assignment
- **WHEN** an assigned access point is deactivated
- **THEN** `default_access_point_id` is preserved
- **THEN** `GET /api/me/workstation` marks `active = false`

#### Scenario: Guard must choose an active gate to start
- **WHEN** the assigned access point is inactive and the guard starts a shift without
  choosing a gate
- **THEN** the response has status 400
- **THEN** the guard can still start a shift by choosing another active access point

#### Scenario: Reactivated access point becomes usable again
- **WHEN** the access point is reactivated
- **THEN** the guard can start a shift there without being reassigned
