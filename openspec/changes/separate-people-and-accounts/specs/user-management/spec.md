## ADDED Requirements

### Requirement: Person and account APIs

The API SHALL expose people and accounts separately.

#### Scenario: Create person
- **WHEN** an authorized user creates a person
- **THEN** the person is created or reused by document/email

#### Scenario: Create account
- **WHEN** an authorized user creates an account for a person
- **THEN** the account is created with a hashed password and unique email

#### Scenario: Update person
- **WHEN** an authorized user updates names, document, phone or contact email
- **THEN** the person is updated and audited

#### Scenario: Deactivate
- **WHEN** a person/account is deactivated
- **THEN** login is blocked but history remains
