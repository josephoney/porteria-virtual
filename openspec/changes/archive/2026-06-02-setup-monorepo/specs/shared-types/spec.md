## ADDED Requirements

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
The shared package SHALL define TypeScript types for core domain entities.

#### Scenario: Organization entity type
- **WHEN** a developer inspects the `Organization` type
- **THEN** it includes at minimum: `id`, `name`, `createdAt`, `updatedAt`
- **THEN** it uses `string` for IDs and `Date` for timestamps

#### Scenario: User entity type with roles
- **WHEN** a developer inspects the `User` type
- **THEN** it includes at minimum: `id`, `email`, `role`, `organizationId`, `createdAt`
- **THEN** `role` is typed as a union of string literals: `'admin' | 'operator' | 'guard' | 'resident'`

#### Scenario: Location entity type
- **WHEN** a developer inspects the `Location` type
- **THEN** it includes at minimum: `id`, `name`, `address`, `organizationId`, `timezone`
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

#### Scenario: User roles enum
- **WHEN** a developer uses `UserRole.Admin`
- **THEN** the value is the string `'admin'`
- **THEN** the enum contains all roles: Admin, Operator, Guard, Resident

### Requirement: Package exports
The shared package SHALL export all types and constants through a single entry point.

#### Scenario: Package main entry point
- **WHEN** another package depends on `@porteria/shared`
- **THEN** importing from `@porteria/shared` resolves to the package's main entry point
- **THEN** all public types, DTOs, and enums are importable from this single entry

#### Scenario: Type-only imports
- **WHEN** a consumer uses `import type { User } from '@porteria/shared'`
- **THEN** the import is erased at compile time with no runtime overhead
