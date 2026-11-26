## ADDED Requirements

### Requirement: Invite unregistered residents by email

Authorized users SHALL invite an email address that does not have an account yet,
without creating the person or the account at invitation time.

#### Scenario: New email invited as resident
- **WHEN** an `org_admin` or `community_admin` invites an unknown email as `resident`
  for one unit of their community
- **THEN** an invitation is created with `status = 'pending'`
- **THEN** no person or account is created yet
- **THEN** the response includes the invitation link exactly once
- **THEN** the invitation email is sent when the provider is configured

#### Scenario: No existing user required
- **WHEN** the invite form is rendered
- **THEN** the resident email is a free text field
- **THEN** choosing a pre-existing user is optional, not required

#### Scenario: Email already a member
- **WHEN** the email already has an active membership for the same scope and role
- **THEN** the response has status 409
- **THEN** the message identifies the existing membership

#### Scenario: Email outside the actor scope
- **WHEN** a `community_admin` invites an email for a unit of another community
- **THEN** the response has status 403

### Requirement: Invitation covers multiple units

An invitation SHALL record every unit it grants, and acceptance SHALL enroll the
resident in all of them.

#### Scenario: Multiple units in the same community
- **WHEN** an invitation is created with two or more units of the same community
- **THEN** the invitation records all of them
- **THEN** the preview lists the units and their location path

#### Scenario: Mixed communities rejected
- **WHEN** the selected units belong to different communities
- **THEN** the response has status 400

#### Scenario: Membership per unit on acceptance
- **WHEN** the invitee accepts an invitation with N units
- **THEN** one membership is created for each unit that is not already granted
- **THEN** memberships that already exist are left untouched
- **THEN** the response reports how many memberships were created

#### Scenario: All units already granted
- **WHEN** every unit in the invitation is already granted to that account
- **THEN** the response has status 409
- **THEN** no duplicate membership is created

### Requirement: Invitation entry points

The dashboard SHALL offer the resident invitation from the unit surfaces.

#### Scenario: Unit row action
- **WHEN** an authorized user opens the actions of a unit
- **THEN** an "Invitar residente" action is available
- **THEN** the dialog opens with that unit preselected

#### Scenario: Structure tree selection
- **WHEN** the user selects one or more units in the structure tree and chooses invite
- **THEN** the dialog opens with the selected units
- **THEN** units outside the user's community are not selectable

#### Scenario: Single unit
- **WHEN** only one unit is selected
- **THEN** the flow behaves like the single-unit invitation

### Requirement: Acceptance completes the profile

A new user SHALL complete their profile while accepting.

#### Scenario: Required data
- **WHEN** the invitee has no account and submits the accept form
- **THEN** name and password are required
- **THEN** the password has at least 8 characters

#### Scenario: Optional profile data
- **WHEN** the invitee provides phone or document
- **THEN** the values are stored on the person record
- **THEN** skipping them does not block acceptance

#### Scenario: Invalid profile data
- **WHEN** the phone or document has an invalid format
- **THEN** the response has status 400
- **THEN** the page shows the error next to the field

#### Scenario: Existing account
- **WHEN** the email already has an account
- **THEN** the page asks to log in instead of creating a second account
- **THEN** after login the memberships are added to the existing account

### Requirement: Pending invitations show their units

The invitation list SHALL expose the scope covered by each invitation.

#### Scenario: List columns
- **WHEN** an authorized user opens the invitations list
- **THEN** each row shows email, role, community, units and status
- **THEN** pending invitations can be resent or revoked
