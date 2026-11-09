## ADDED Requirements

### Requirement: Account-based login

Authentication SHALL use the account email and password.

#### Scenario: Login by account
- **WHEN** a user logs in with an account email/password
- **THEN** the server resolves the account and its person
- **THEN** the access token contains `sub` (account id), `personId`, `orgId`,
  `membershipId`, `role`, `communityId`, `unitId`, `isPlatformAdmin`

#### Scenario: Person without account
- **WHEN** a person has no account
- **THEN** login is rejected

#### Scenario: Deactivated account
- **WHEN** an account is inactive
- **THEN** login is rejected with 401

### Requirement: Token context

Tokens SHALL carry both account and person identity.

#### Scenario: Refresh
- **WHEN** a refresh token is used
- **THEN** the new access token preserves `accountId` and `personId`

#### Scenario: Context switch
- **WHEN** the user switches membership
- **THEN** the new token keeps the same account/person and updates the membership context

#### Scenario: Legacy tokens
- **WHEN** a token without `personId` is received after migration
- **THEN** it is rejected with 401
