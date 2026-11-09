## ADDED Requirements

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
