## Purpose

Shared TypeScript types, enums and DTOs used across apps and servers.
## Requirements
### Requirement: Shared TypeScript type definitions
The `@porteria/shared` package SHALL export TypeScript types, interfaces, enums, and DTOs used across all apps and servers.

#### Scenario: Importing a shared type
- **WHEN** a file in `apps/dashboard` imports `import { Organization } from '@porteria/shared'`
- **THEN** the `Organization` type is available with full TypeScript autocompletion
- **THEN** the type is identical across all consumers

#### Scenario: Type changes propagate
- **WHEN** a type in `packages/shared` is modified
- **THEN** TypeScript immediately reports errors in all consuming files
- **THEN** the developer can fix type errors before runtime

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

### Requirement: API DTOs
The shared package SHALL define Data Transfer Objects for API request and response payloads.

#### Scenario: Login request DTO
- **WHEN** a developer inspects the `LoginRequest` type
- **THEN** it includes `email: string` and `password: string`

#### Scenario: Paginated response DTO
- **WHEN** a developer inspects the `PaginatedResponse<T>` generic type
- **THEN** it includes `data: T[]`, `total: number`, `page: number`, `pageSize: number`

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

### Requirement: Package exports
The shared package SHALL export all types and constants through a single entry point.

#### Scenario: Package main entry point
- **WHEN** another package depends on `@porteria/shared`
- **THEN** importing from `@porteria/shared` resolves to the package's main entry point
- **THEN** all public types, DTOs, and enums are importable from this single entry

#### Scenario: Type-only imports
- **WHEN** a consumer uses `import type { User } from '@porteria/shared'`
- **THEN** the import is erased at compile time with no runtime overhead

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

### Requirement: Tenant slug and public community types

The shared package SHALL define types for slugs and public community resolution.

#### Scenario: Public community type
- **WHEN** a developer inspects `PublicCommunity`
- **THEN** it includes `id`, `name`, `slug`, `address`, `timezone`, and
  `organization: { id, name, slug }`
- **THEN** it does not include members, units, or users

#### Scenario: Slug template type
- **WHEN** a developer inspects `SlugTemplate`
- **THEN** it includes `minLength`, `maxLength`, `pattern`, and `reservedWords`

### Requirement: Invitation types and DTOs

The shared package SHALL define invitation contracts.

#### Scenario: Invitation status enum
- **WHEN** a developer uses `InvitationStatus.Pending`
- **THEN** the value is the string `'pending'`
- **THEN** the enum includes `Pending`, `Accepted`, `Revoked`, and `Expired`

#### Scenario: Invitation entity type
- **WHEN** a developer inspects `Invitation`
- **THEN** it includes `id`, `email`, `organizationId`, `communityId`, `unitId`,
  `role`, `status`, `expiresAt`, `acceptedAt`, `invitedBy`, `createdAt`

#### Scenario: Create invitation DTO
- **WHEN** a developer inspects `CreateInvitationDto`
- **THEN** it includes `email`, `role`, `organizationId?`, `communityId?`, `unitId?`,
  and `expiresInDays?`

#### Scenario: Accept invitation DTO
- **WHEN** a developer inspects `AcceptInvitationDto`
- **THEN** it includes `name?` and `password?`

#### Scenario: Invitation created response
- **WHEN** a developer inspects `InvitationCreatedResponse`
- **THEN** it includes `invitation` and `acceptUrl`
- **THEN** the raw token is not represented outside `acceptUrl`

#### Scenario: Public invitation preview
- **WHEN** a developer inspects `PublicInvitationPreview`
- **THEN** it includes `communityName`, `unitCode`, `role`, and `maskedEmail`

### Requirement: Platform management DTOs

The shared package SHALL define platform CRUD contracts.

#### Scenario: Create organization DTO
- **WHEN** a developer inspects `CreateOrganizationDto`
- **THEN** it includes `name` and optional `slug`

#### Scenario: Create community DTO
- **WHEN** a developer inspects `CreateCommunityDto`
- **THEN** it includes `organizationId`, `name`, `address`, `timezone`, and optional
  `slug`

#### Scenario: Create building DTO
- **WHEN** a developer inspects `CreatePlatformBuildingDto`
- **THEN** it includes `communityId`, `name`, optional `code`, and optional `floors`

#### Scenario: Create unit DTO
- **WHEN** a developer inspects `CreatePlatformUnitDto`
- **THEN** it includes `communityId`, optional `buildingId`, `code`, optional `floor`,
  and `type`

### Requirement: Event envelope type

The shared package SHALL define the versioned event envelope used by producers and
consumers.

#### Scenario: Envelope fields
- **WHEN** a developer inspects `EventEnvelope`
- **THEN** it includes `eventId`, `eventType`, `version`, `occurredAt`,
  `organizationId`, `communityId?`, `actor?`, `accessPointId?`, `payload`

#### Scenario: Producer helper
- **WHEN** a producer creates an envelope
- **THEN** `eventId` is a new UUID and `occurredAt` is an ISO timestamp

### Requirement: Outbox status type

The shared package SHALL define the outbox lifecycle statuses.

#### Scenario: Outbox status enum
- **WHEN** a developer uses `OutboxStatus.Pending`
- **THEN** the value is the string `'pending'`
- **THEN** the enum includes `Pending`, `Processing`, `Done`, and `Dead`

#### Scenario: Outbox stats type
- **WHEN** a developer inspects `OutboxStats`
- **THEN** it includes `pending`, `processing`, `dead`, `oldestPendingAge`, and
  `lastError`

