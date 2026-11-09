## ADDED Requirements

### Requirement: Tenancy and membership types

The shared package SHALL define types for the tenancy hierarchy and memberships.

#### Scenario: Community type

- **WHEN** a developer inspects the `Community` type
- **THEN** it includes `id`, `name`, `address`, `timezone`, `organizationId`,
  `status`, `createdAt`, `updatedAt`

#### Scenario: Building and Unit types

- **WHEN** a developer inspects `Building` and `Unit`
- **THEN** `Building` includes `id`, `communityId`, `name`, `code`, `floors`
- **THEN** `Unit` includes `id`, `communityId`, `buildingId`, `code`, `floor`, `type`,
  `status`

#### Scenario: Membership type

- **WHEN** a developer inspects the `Membership` type
- **THEN** it includes `id`, `userId`, `organizationId`, `communityId`, `unitId`,
  `role`, `status`, `validFrom`, `validTo`

#### Scenario: Active context type

- **WHEN** a developer inspects the `AuthContext` type
- **THEN** it includes `userId`, `email`, `orgId`, `membershipId`, `role`,
  `communityId`, `unitId`, `isPlatformAdmin`

### Requirement: Auth DTOs for membership context

The shared package SHALL define DTOs for login context selection and switching.

#### Scenario: Login response with memberships

- **WHEN** a developer inspects the login response type
- **THEN** it can represent either `{ accessToken, refreshToken, user,
  activeMembership }` or `{ requiresContextSelection: true, memberships: [...] }`

#### Scenario: Context switch DTO

- **WHEN** a developer inspects the context switch request DTO
- **THEN** it includes `membershipId: string`

## MODIFIED Requirements

### Requirement: Domain entity types
The shared package SHALL define TypeScript types for core domain entities of the
tenancy hierarchy.

#### Scenario: Organization entity type
- **WHEN** a developer inspects the `Organization` type
- **THEN** it includes at minimum: `id`, `name`, `createdAt`, `updatedAt`
- **THEN** it uses `string` for IDs and `Date` for timestamps

#### Scenario: User entity type
- **WHEN** a developer inspects the `User` type
- **THEN** it includes at minimum: `id`, `email`, `name`, `isPlatformAdmin`,
  `active`, `createdAt`
- **THEN** it does NOT include a global `role`, `organizationId`, or `locationId`
- **THEN** tenant roles are represented by `Membership`

#### Scenario: Community entity type
- **WHEN** a developer inspects the `Community` type
- **THEN** it includes at minimum: `id`, `name`, `address`, `organizationId`,
  `timezone`, `status`
- **THEN** it references `Organization` through `organizationId`

### Requirement: Enum constants
The shared package SHALL define enum-like constants for domain values.

#### Scenario: Event types enum
- **WHEN** a developer uses `EventType.CallStarted`
- **THEN** the value is the string `'call.started'`
- **THEN** TypeScript enforces that only valid event types are used

#### Scenario: Membership roles enum
- **WHEN** a developer uses `MembershipRole.OrgAdmin`
- **THEN** the value is the string `'org_admin'`
- **THEN** the enum contains all roles: `OrgAdmin`, `CommunityAdmin`, `Operator`,
  `Guard`, `Owner`, `Tenant`, `Resident`, `Staff`

#### Scenario: Legacy user role removed
- **WHEN** a developer inspects `@porteria/shared`
- **THEN** `UserRole` no longer exposes `admin`, `operator`, `guard`, or `resident` as
  global user roles
- **THEN** those concepts exist only as `MembershipRole` values
