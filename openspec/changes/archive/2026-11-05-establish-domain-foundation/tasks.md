## 1. Shared types and enums

- [x] 1.1 Add `MembershipRole` enum with `org_admin`, `community_admin`, `operator`, `guard`, `owner`, `tenant`, `resident`, `staff`; remove the global `UserRole` as the authorization source
- [x] 1.2 Add `MembershipStatus` enum (`active`, `inactive`) and `CommunityStatus` enum (`active`, `inactive`)
- [x] 1.3 Add `Community`, `Building`, `Unit`, `UnitType`, `Membership`, `AuthContext` interfaces in `packages/shared/src/types/`
- [x] 1.4 Add DTOs: `LoginResponse` union (tokens vs context selection), `ContextSwitchRequest`, `CreateMembershipDto`, `CreateUnitDto` in `packages/shared/src/dto/`
- [x] 1.5 Fix the `Call` type to match the schema: `communityId`, nullable `operatorId`, nullable `accessPointId`
- [x] 1.6 Export all new types/enums/DTOs from `packages/shared/src/index.ts`

## 2. Database schema

- [x] 2.1 Rename `locations.ts` to `communities.ts`; add `status` and keep `organization_id`, `address`, `timezone`
- [x] 2.2 Create `buildings.ts` (`id`, `community_id`, `name`, `code`, `floors`, timestamps)
- [x] 2.3 Create `units.ts` (`id`, `community_id`, `building_id?`, `code`, `floor?`, `type`, `status`, timestamps) with unique `(community_id, code)`
- [x] 2.4 Create `memberships.ts` (`id`, `user_id`, `organization_id`, `community_id?`, `unit_id?`, `role`, `status`, `valid_from`, `valid_to`, timestamps) with unique index using `NULLS NOT DISTINCT`
- [x] 2.5 Update `users.ts`: remove `role`, `organization_id`, `location_id`; add `is_platform_admin`; make email globally unique
- [x] 2.6 Update `access-points.ts`: replace `location_id` with `community_id` (cascade)
- [x] 2.7 Update `kiosks.ts`: add required `community_id`; keep nullable unique `access_point_id`
- [x] 2.8 Update `calls.ts`: add `community_id`; make `access_point_id` nullable
- [x] 2.9 Update `events.ts`: replace `location_id` with `community_id`
- [x] 2.10 Update `guard-rounds.ts`: replace `location_id` with `community_id`
- [x] 2.11 Update `relations.ts` for communities, buildings, units, memberships, kiosks, access points, calls, events, rounds
- [x] 2.12 Update `schema/index.ts` exports

## 3. Migration

- [x] 3.1 Run `pnpm --filter @porteria/database db:generate` to produce the snapshot
- [x] 3.2 Hand-write `migrations/0002_establish_foundation.sql` using `ALTER TABLE locations RENAME TO communities` (no drop/create)
- [x] 3.3 Add table creation for `buildings`, `units`, `memberships` with FKs and indexes
- [x] 3.4 Backfill: create one membership per existing user from role/org/location; map `users.location_id` to `community_id`
- [x] 3.5 Backfill `kiosks.community_id` from `access_points.location_id`; enforce `NOT NULL`
- [x] 3.6 Migrate `access_points.location_id`, `events.location_id`, `guard_rounds.location_id` to `community_id`
- [x] 3.7 Drop `users.role`, `users.organization_id`, `users.location_id`
- [x] 3.8 Revoke existing refresh tokens in the migration
- [x] 3.9 Add a documented down/rollback comment block
- [x] 3.10 Run `pnpm --filter @porteria/database db:migrate` and verify row counts before/after

## 4. Seed data

- [x] 4.1 Rewrite seed to create two organizations with different communities
- [x] 4.2 Create buildings and units for one demo community
- [x] 4.3 Create a platform admin user (`superadmin@porteria.local`) with `is_platform_admin = true`
- [x] 4.4 Create `org_admin`, `community_admin`, `operator`, `guard`, `owner`, `resident` memberships scoped correctly
- [x] 4.5 Create access point, kiosk and relay outputs linked to a community
- [x] 4.6 Keep the seed idempotent and print demo credentials

## 5. Authentication and context

- [x] 5.1 Update `auth.service.login` to load active memberships and return tokens only when there is a single (or platform) context
- [x] 5.2 Return `{ requiresContextSelection: true, memberships }` when multiple memberships exist
- [x] 5.3 Add `createContextTokens(user, membership)` and `POST /api/auth/context`
- [x] 5.4 Revoke the previous refresh token on context switch
- [x] 5.5 Update `POST /api/auth/refresh` to restore and validate the membership context
- [x] 5.6 Update JWT claims to `{ sub, email, orgId, membershipId, role, communityId?, unitId?, isPlatformAdmin }`
- [x] 5.7 Update the auth plugin to reject tokens whose membership is inactive
- [x] 5.8 Update login/refresh response DTOs in `@porteria/shared`

## 6. RBAC

- [x] 6.1 Rewrite `middlewares/rbac.ts` `requireRole` to read the active membership role
- [x] 6.2 Add a `requireCommunityAccess` helper that validates `communityId` against the active membership
- [x] 6.3 Update `requireSelfOrRole` for the new identity model
- [x] 6.4 Type `request.user` with the new `AuthContext`

## 7. Users and memberships API

- [x] 7.1 Update `users.service.listUsers` to join memberships, filter by organization and optional community, and return membership data
- [x] 7.2 Update `users.service.createUser` to create the global user and initial membership in one transaction
- [x] 7.3 Update `users.service.getUserById` to include memberships within the caller's scope
- [x] 7.4 Update `users.service.updateUser` to change only global fields (name, active)
- [x] 7.5 Add `POST /api/memberships` and `PATCH /api/memberships/:id` routes and services
- [x] 7.6 Enforce role scope rules (operational roles require community, occupants require unit)
- [x] 7.7 Update `GET /api/me` to return the profile plus active context

## 8. Kiosks, calls, events and reports

- [x] 8.1 Update `kiosks.service.listKiosks` to join communities and filter by `communityId`
- [x] 8.2 Extend `kiosksQuerySchema` with optional `communityId`
- [x] 8.3 Update `calls.service.createCall`/`updateCall` to persist `community_id`
- [x] 8.4 Update `events.service.insertEvent` to accept `communityId` and write it
- [x] 8.5 Update `POST /api/internal/events` to resolve community and organization consistently
- [x] 8.6 Add optional `communityId` filtering to reports and dashboard stats
- [x] 8.7 Update dashboard stats queries to scope by active organization and community

## 9. Signaling server

- [x] 9.1 Change `kiosk:register` payload to `{ kioskId, communityId, name }` and resolve the kiosk from the database
- [x] 9.2 Update signaling state to key kiosks by `kioskId` and store `communityId`/`organizationId`
- [x] 9.3 Update `persist.ts` call/event persistence to use the resolved community and organization
- [x] 9.4 Update operator registration to carry the active community context
- [x] 9.5 Remove all use of `buildingId` as a kiosk identifier from types and payloads
- [x] 9.6 Update `server/signaling/src/types.ts` with the new payloads

## 10. Dashboard

- [x] 10.1 Update `AuthContext` to store `user`, `activeMembership` and the membership list
- [x] 10.2 Implement the context-selection step in the login flow
- [x] 10.3 Update `apiClient`/auth recovery to handle the new login response
- [x] 10.4 Add a community selector for users with multiple communities or org admins
- [x] 10.5 Update the users table/forms to manage memberships (role + community + unit)
- [x] 10.6 Update kiosk and report views to display/filter by community
- [x] 10.7 Fix all imports of the removed `Location`/`UserRole` types

## 11. Verification

- [x] 11.1 Run `pnpm --filter @porteria/database db:migrate` from a clean database and confirm it succeeds
- [x] 11.2 Run `pnpm --filter @porteria/database db:seed` twice and confirm idempotency
- [x] 11.3 Log in as single-membership user and confirm tokens include the correct context
- [x] 11.4 Log in as multi-membership user, switch context, and confirm the old refresh token is revoked
- [x] 11.5 Attempt cross-tenant access to a community resource and confirm 403/404
- [x] 11.6 Start a kiosk↔operator call and confirm events/calls persist with the correct community
- [x] 11.7 Request reports/dashboard stats filtered by community and confirm correct scoping
- [x] 11.8 Run `pnpm lint` and `tsc --noEmit` across the workspace
