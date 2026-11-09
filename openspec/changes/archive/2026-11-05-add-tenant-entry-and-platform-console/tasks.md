## 1. Shared types and DTOs

- [x] 1.1 Add `SlugTemplate` constants (length, pattern, reserved words) in `packages/shared/src/constants/`
- [x] 1.2 Add `PublicCommunity` and `PublicOrganization` types
- [x] 1.3 Add `InvitationStatus` enum and `Invitation` type
- [x] 1.4 Add `CreateInvitationDto`, `AcceptInvitationDto`, `InvitationCreatedResponse`, `PublicInvitationPreview`
- [x] 1.5 Add `CreateOrganizationDto`, `CreateCommunityDto`, `CreatePlatformBuildingDto`, `CreatePlatformUnitDto`
- [x] 1.6 Add optional `communitySlug` to `LoginRequest`
- [x] 1.7 Export all new types/DTOs from `packages/shared/src/index.ts`

## 2. Database schema and migration

- [x] 2.1 Add `slug` column to `schema/organizations.ts` (unique, not null)
- [x] 2.2 Add `slug` column to `schema/communities.ts` (unique, not null)
- [x] 2.3 Create `schema/invitations.ts` with status enum and indexes
- [x] 2.4 Update `relations.ts` and `schema/index.ts`
- [x] 2.5 Generate the migration for slugs and invitations
- [x] 2.6 Hand-write the backfill: slug from name, normalize accents, resolve collisions, then `NOT NULL`
- [x] 2.7 Add rollback comment block
- [x] 2.8 Apply the migration and verify existing communities receive slugs

## 3. Slug service

- [x] 3.1 Implement `slugify(name)` with accent normalization and length limits
- [x] 3.2 Implement format validation and reserved-word validation
- [x] 3.3 Implement collision resolution with numeric suffixes
- [x] 3.4 Implement `ensureUniqueSlug(entity, desiredSlug, excludeId?)`
- [ ] 3.5 Add unit tests for valid, invalid, reserved, long, and colliding slugs

## 4. Public resolution API

- [x] 4.1 Add `GET /api/public/communities/:slug`
- [x] 4.2 Return only `id`, `name`, `slug`, `address`, `timezone`, and organization
- [x] 4.3 Return 404 for unknown or inactive communities
- [x] 4.4 Add rate limiting and `Cache-Control`
- [x] 4.5 Register the public routes without JWT

## 5. Community-scoped login

- [x] 5.1 Accept optional `communitySlug` in `loginSchema`
- [x] 5.2 Resolve the community by slug and reject unknown/inactive with 404
- [x] 5.3 Filter active memberships to the community when the slug is present
- [x] 5.4 Return 403 when the user has no membership in the community
- [x] 5.5 Keep the no-slug behavior unchanged
- [x] 5.6 Keep platform admin behavior unchanged
- [x] 5.7 Add tests for single, multiple, none, unknown, and platform admin cases

## 6. Invitation service and API

- [x] 6.1 Create `server/api/src/modules/invitations/invitation.service.ts`
- [x] 6.2 Implement token generation (32 bytes), SHA-256 hashing, and link building
- [x] 6.3 Implement scope validation for platform, org, community, and unit roles
- [x] 6.4 Implement create invitation with duplicate-member and scope checks
- [x] 6.5 Implement revoke and resend (rotate token)
- [x] 6.6 Implement expiration handling
- [x] 6.7 Add `POST /api/invitations` (authenticated, scoped)
- [x] 6.8 Add `GET /api/invitations` with filters and pagination
- [x] 6.9 Add `POST /api/invitations/:id/revoke`
- [x] 6.10 Add `POST /api/invitations/:id/resend`
- [x] 6.11 Add rate limits for creation and acceptance
- [ ] 6.12 Add audit events for create/revoke/resend/accept/expire

## 7. Invitation acceptance

- [x] 7.1 Add `GET /api/public/invitations/:token` preview (masked email)
- [x] 7.2 Add `POST /api/public/invitations/:token/accept`
- [x] 7.3 New email: create user, membership, mark accepted, issue tokens
- [x] 7.4 Existing email without session: 409 “log in first”
- [x] 7.5 Existing email with matching session: create membership and issue context
- [x] 7.6 Reject a session for a different email with 403
- [x] 7.7 Reject reused, revoked, or expired tokens with 410
- [x] 7.8 Handle concurrent new-email accepts safely

## 8. Platform API

- [x] 8.1 Add platform guard (`isPlatformAdmin`) for `/api/platform/*`
- [x] 8.2 Add organization CRUD (`GET`, `POST`, `PATCH`)
- [x] 8.3 Add community CRUD with slug validation
- [x] 8.4 Add building CRUD scoped to community
- [x] 8.5 Add unit CRUD with unique code per community
- [x] 8.6 Add invite `org_admin` endpoint
- [x] 8.7 Add pagination, search, and organization filters
- [x] 8.8 Add audit events for structure changes
- [x] 8.9 Ensure tenant endpoints remain isolated

## 9. Dashboard platform console

- [x] 9.1 Add `/platform` route protected by `isPlatformAdmin`
- [x] 9.2 Add “Plataforma” navigation item for platform admins
- [x] 9.3 Build organizations list/create/edit
- [x] 9.4 Build communities list/create/edit with slug field
- [x] 9.5 Build buildings list/create/edit
- [x] 9.6 Build units list/create/edit
- [x] 9.7 Build invitations list/create/revoke/resend with copyable link
- [ ] 9.8 Show warning when an organization has no `org_admin`

## 10. Community entry route

- [x] 10.1 Add public route `/c/:slug` in the dashboard router
- [x] 10.2 Fetch and render community branding
- [x] 10.3 Pass `communitySlug` to the login request
- [x] 10.4 Show not-found state for unknown/inactive slugs
- [x] 10.5 Keep the global `/login` route working
- [x] 10.6 Redirect to the dashboard with the active context after login
- [x] 10.7 Allow context switching after scoped login

## 11. Seed and configuration

- [x] 11.1 Seed slugs for both organizations and both communities
- [ ] 11.2 Seed one pending resident invitation with a known token in dev
- [ ] 11.3 Add invitation expiry and rate-limit env keys
- [x] 11.4 Keep the seed idempotent

## 12. Verification

- [ ] 12.1 `/c/torre-norte` resolves and renders branding
- [ ] 12.2 Unknown or inactive slug returns 404
- [x] 12.3 Scoped login with a Torre Norte user returns only Torre Norte context
- [x] 12.4 Scoped login with a Los Álamos-only user returns 403
- [x] 12.5 Multi-membership user sees only memberships of the scoped community
- [ ] 12.6 Platform admin logs in and can open `/platform`
- [ ] 12.7 Platform admin creates org, community, building, and unit
- [ ] 12.8 Platform admin invites an `org_admin` and the link works
- [x] 12.9 New user accepts an invitation and lands logged in
- [ ] 12.10 Existing user accepts only while authenticated
- [ ] 12.11 Invitation cannot be reused, revoked, or expired
- [x] 12.12 `pnpm lint` passes
- [x] 12.13 `tsc --noEmit` passes for all packages
