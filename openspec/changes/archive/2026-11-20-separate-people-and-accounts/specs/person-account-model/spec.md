## ADDED Requirements

### Requirement: Person entity

The system SHALL store people independently from accounts.

#### Scenario: Create person
- **WHEN** a person is created with names, document type/number, phone, contact email and
  status
- **THEN** the person is persisted with a global id
- **THEN** it can exist without an account

#### Scenario: Unique document
- **WHEN** a person is created with a document type/number already registered
- **THEN** the system returns the existing person or rejects the duplicate

#### Scenario: Multiple associations
- **WHEN** a person is associated to two communities
- **THEN** only one person row exists
- **THEN** the associations are stored separately

### Requirement: Account entity

The system SHALL store credentials separately from the person.

#### Scenario: Create account
- **WHEN** an account is created for a person with an email and password
- **THEN** only the password hash is stored
- **THEN** the email is unique across accounts

#### Scenario: Optional account
- **WHEN** a person has no account
- **THEN** the person can still have associations (base for subusers)

#### Scenario: One account per person
- **WHEN** a second account is created for the same person
- **THEN** the request is rejected with 409

#### Scenario: Platform admin flag
- **WHEN** an account has `is_platform_admin = true`
- **THEN** it can access platform endpoints
- **THEN** tenant access still requires an association

### Requirement: Associations against people

Memberships SHALL reference the person, not the account.

#### Scenario: Membership creation
- **WHEN** a membership is created
- **THEN** it stores `person_id`, organization, optional community/location, role and
  status

#### Scenario: Person without account
- **WHEN** a person without account receives an association
- **THEN** the association is valid for authorization/traceability
- **THEN** they cannot log in until an account is created

### Requirement: Person deduplication

The system SHALL avoid duplicate people.

#### Scenario: Existing document
- **WHEN** a person is created with an existing document
- **THEN** the system reuses the existing person

#### Scenario: Existing contact email
- **WHEN** no document is provided and the contact email matches an existing person
- **THEN** the system asks to reuse or review the existing person

#### Scenario: Account email conflict
- **WHEN** an account email already exists
- **THEN** the request is rejected with 409

### Requirement: Migration from users

The migration SHALL preserve existing identities.

#### Scenario: Backfill
- **WHEN** the migration runs on existing `users`
- **THEN** one person and one account are created per user
- **THEN** memberships are linked to the person
- **THEN** a `userId → personId` map is retained for rollback

#### Scenario: Token invalidation
- **WHEN** the migration runs
- **THEN** existing refresh tokens are revoked

#### Scenario: Verification
- **WHEN** the migration finishes
- **THEN** counts of people, accounts and memberships match the expected mapping

### Requirement: Privacy

Personal data SHALL be exposed according to role.

#### Scenario: List masking
- **WHEN** a user lists people outside their scope
- **THEN** document/phone are masked or omitted

#### Scenario: Password hash
- **WHEN** an account is returned by the API
- **THEN** `password_hash` is never included
