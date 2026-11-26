## MODIFIED Requirements

### Requirement: Create user

The API SHALL provide a `POST /api/users` endpoint for admins to create a global user
and an initial membership, subject to the role assignment policy. The account SHALL be
created in an inactive state: the admin no longer chooses the password, and the person
receives a single-use activation link to set it.

#### Scenario: Admin creates user with membership
- **WHEN** an `org_admin` makes a POST request with `{ email, name, role,
  communityId?, locationUnitId? }`
- **THEN** a global user is created with an unusable random password hash
- **THEN** a membership is created in the admin's organization with the given role and
  scope
- **THEN** the response has status 201 with the user and membership (without
  `password_hash`)
- **THEN** the response includes `emailSent` and, when delivery failed, the
  `activationUrl` exactly once

#### Scenario: Password is not accepted from the admin
- **WHEN** a request includes `password`
- **THEN** the value is ignored; the admin cannot set the account password

#### Scenario: Occupant requires location unit
- **WHEN** an admin creates an `owner`, `tenant` or `resident`
- **THEN** `locationUnitId` is required
- **THEN** the location must be a leaf in the selected community

#### Scenario: Platform admin creates org_admin
- **WHEN** a platform admin creates a user with `role = 'org_admin'`
- **THEN** the assignment is allowed

#### Scenario: Org admin cannot create org_admin
- **WHEN** an `org_admin` tries to create a user with `role = 'org_admin'`
- **THEN** the response has status 403

#### Scenario: Community admin cannot create org_admin or community_admin
- **WHEN** a `community_admin` tries to create a user with `role = 'org_admin'` or
  `role = 'community_admin'`
- **THEN** the response has status 403

#### Scenario: Community admin creates community role
- **WHEN** a `community_admin` creates an `operator`, `guard`, `owner`, `tenant`,
  `resident`, or `staff` in their community
- **THEN** the assignment is allowed

#### Scenario: Duplicate email
- **WHEN** an admin tries to create a user with an email that already exists
- **THEN** the response has status 409

#### Scenario: Invalid role
- **WHEN** a request includes an invalid role value
- **THEN** the response has status 400 with validation error

#### Scenario: Invalid scope for role
- **WHEN** a request creates an operational role without `communityId`
- **THEN** the response has status 400 with a scope validation error

## ADDED Requirements

### Requirement: Account activation for admin-created users

A user created directly by an administrator SHALL set their own password through a
single-use activation link.

#### Scenario: Activation link
- **WHEN** the user is created
- **THEN** a single-use token is issued and stored only as a hash
- **THEN** it expires after 60 minutes
- **THEN** the email explains that the account was created and links to the
  set-password page

#### Scenario: Delivery failure
- **WHEN** the email provider is not configured or fails
- **THEN** the user and membership are still created
- **THEN** the response returns `emailSent: false` and the activation link once
- **THEN** the link is never retrievable again

#### Scenario: Set password
- **WHEN** the person opens the link and submits a password of at least 8 characters
- **THEN** the account password is updated with a bcrypt hash
- **THEN** the token is marked as used
- **THEN** the person can log in with the new password

#### Scenario: Weak or expired password
- **WHEN** the password has fewer than 8 characters
- **THEN** the response has status 400
- **WHEN** the token is expired or already used
- **THEN** the response has status 410

#### Scenario: Cannot log in before activation
- **WHEN** the person tries to log in before setting a password
- **THEN** the credentials are rejected

#### Scenario: Resend activation
- **WHEN** an admin resends the activation for an account that never set a password
- **THEN** a new token is issued and the previous one is invalidated
- **THEN** the new link is returned once and the email is sent
- **WHEN** the account already set a password
- **THEN** the response has status 409

#### Scenario: Scope of resend
- **WHEN** an admin resends activation for a user outside their organization or
  community
- **THEN** the response has status 403

#### Scenario: Audit
- **WHEN** an activation is sent, resent or completed
- **THEN** an event is recorded with the account id, actor and result
