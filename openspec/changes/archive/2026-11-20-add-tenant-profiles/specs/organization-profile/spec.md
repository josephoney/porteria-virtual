## ADDED Requirements

### Requirement: Organization profile fields

The system SHALL store organization contact, legal and branding profile data.

#### Scenario: Profile fields
- **WHEN** an organization profile is read
- **THEN** it includes name, slug, NIT, phone, address, legal representative, logo and
  welcome message
- **THEN** every profile field except name/slug may be null until completed

#### Scenario: NIT optional at creation
- **WHEN** a superadmin creates an organization
- **THEN** only name, slug and administrator email are required
- **THEN** NIT and the remaining profile fields remain empty until the org admin
  completes them

#### Scenario: NIT normalization
- **WHEN** a NIT is saved
- **THEN** it is stored as a normalized value without a check digit
- **THEN** an empty NIT is stored as null

#### Scenario: Unique NIT
- **WHEN** a non-null NIT already belongs to another organization
- **THEN** the update is rejected with status 409

#### Scenario: Multiple null NITs
- **WHEN** two organizations have no NIT
- **THEN** both can exist without a uniqueness violation

### Requirement: Organization administrator read model

The organization profile SHALL resolve its administrator from membership data.

#### Scenario: Active administrator
- **WHEN** an organization has an active `org_admin` membership
- **THEN** the profile includes the administrator person's names, document, phone and
  contact email

#### Scenario: Pending administrator invitation
- **WHEN** the organization has a pending `org_admin` invitation and no active admin
- **THEN** the profile shows the invited email and `pending` state
- **THEN** it does not expose a fake person name

#### Scenario: Administrator assignment
- **WHEN** the invitation is accepted
- **THEN** the profile resolves the new person as the organization administrator

### Requirement: Legal representative

The organization SHALL reference a person as its legal representative.

#### Scenario: Person without account
- **WHEN** an organization admin assigns a legal representative person without an account
- **THEN** the reference is saved
- **THEN** the legal representative can be displayed without login credentials

#### Scenario: Reuse person
- **WHEN** the same document is used for another organization role
- **THEN** the existing person is reused instead of creating a duplicate

#### Scenario: Legal representative privacy
- **WHEN** a non-admin lists people
- **THEN** document and phone are masked or omitted according to role

### Requirement: Profile permissions

Organization profile edits SHALL be scoped.

#### Scenario: Org admin edits own profile
- **WHEN** an `org_admin` updates NIT, phone, address, legal representative or welcome
  message for their organization
- **THEN** the update is allowed and audited

#### Scenario: Superadmin reads only
- **WHEN** a platform admin requests an organization profile
- **THEN** the profile is returned
- **WHEN** the platform admin tries to update profile fields
- **THEN** the response has status 403

#### Scenario: Cross-organization write
- **WHEN** an org admin updates another organization
- **THEN** the response has status 404

### Requirement: Organization welcome

The organization SHALL support a welcome message.

#### Scenario: Welcome rendered
- **WHEN** an organization has a welcome message
- **THEN** the organization home shows it to members in that organization

#### Scenario: Empty welcome
- **WHEN** the welcome message is null
- **THEN** the organization home shows its default empty state
