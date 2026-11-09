## 1. Schema and migration

- [x] 1.1 Add organization profile columns: `nit`, `phone`, `address`, `legal_representative_person_id`, `logo_asset_id`, `welcome_message`, `profile_completed_at`
- [x] 1.2 Add community profile columns: `phone`, `type`, `type_label`, `latitude`, `longitude`, `logo_asset_id`, `welcome_message`
- [x] 1.3 Create `assets` table and organization/community foreign keys
- [x] 1.4 Add partial unique index on `organizations.nit` where `nit is not null`
- [x] 1.5 Generate and manually review the migration
- [x] 1.6 Add rollback and backup notes
- [x] 1.7 Verify existing organizations/communities are readable after migration

## 2. Domain and validation

- [x] 2.1 Implement NIT normalization without check digit
- [x] 2.2 Add phone/address validation and trimming
- [x] 2.3 Add community type catalog and `otro` label requirement
- [x] 2.4 Add latitude/longitude range validation
- [x] 2.5 Resolve organization admin from active `org_admin` membership + person
- [x] 2.6 Resolve legal representative person without requiring an account
- [x] 2.7 Add profile completeness calculation
- [x] 2.8 Add audit events for profile changes

## 3. Assets

- [x] 3.1 Create storage adapter interface
- [x] 3.2 Implement local filesystem adapter for development
- [x] 3.3 Implement S3-compatible adapter contract for production
- [x] 3.4 Enforce PNG/JPEG/WEBP MIME types
- [x] 3.5 Enforce 500 KB maximum file size
- [x] 3.6 Store checksum, MIME, size and storage key
- [x] 3.7 Replace/delete previous logo safely
- [x] 3.8 Add upload/read/delete authorization by organization scope
- [x] 3.9 Add audit events for asset upload/replacement

## 4. API

- [x] 4.1 Add `GET /api/organizations/me`
- [x] 4.2 Add `PATCH /api/organizations/me` for org_admin only
- [x] 4.3 Add `GET /api/organizations/me/communities`
- [x] 4.4 Add `POST /api/organizations/me/communities` for org_admin only
- [x] 4.5 Add `GET /api/communities/:id/overview`
- [x] 4.6 Add `PATCH /api/communities/:id` scoped to org/community admin
- [x] 4.7 Add `POST /api/assets` and `GET /api/assets/:id`
- [x] 4.8 Return only readable profile fields to superadmin
- [x] 4.9 Return pending organization/community admin invitation state
- [x] 4.10 Enforce 403/404 consistently for cross-tenant access

## 5. Dashboard

- [x] 5.1 Build organization profile form with NIT, phone, address and legal representative
- [x] 5.2 Build organization logo upload with square guidance
- [x] 5.3 Build organization welcome message editor
- [x] 5.4 Build community profile form with phone, type, address, coordinates and welcome
- [x] 5.5 Build community logo upload and fallback preview
- [x] 5.6 Show profile completeness and pending administrator state
- [x] 5.7 Use organization/community logo in the sidebar header
- [x] 5.8 Render default logo when no asset exists
- [x] 5.9 Show validation errors inline and preserve unsaved fields on failure

## 6. Tests

### Unit

- [x] 6.1 NIT normalization without check digit
- [x] 6.2 Null NIT allowed; duplicate non-null NIT rejected
- [x] 6.3 Community type catalog and `otro` label validation
- [x] 6.4 Latitude/longitude range validation
- [x] 6.5 MIME and 500 KB upload validation
- [x] 6.6 Profile completeness calculation
- [x] 6.7 Permission matrix for profile reads/writes

### Integration

- [x] 6.8 Org admin completes own profile; superadmin sees it
- [x] 6.9 Superadmin cannot edit profile fields
- [x] 6.10 Org admin cannot edit another organization
- [x] 6.11 Org admin creates/edits a community in own organization
- [x] 6.12 Community admin edits only assigned communities
- [x] 6.13 `type=otro` without label returns 400
- [x] 6.14 Invalid coordinates return 400
- [x] 6.15 Valid org/community logo upload returns 201
- [x] 6.16 Invalid MIME or size returns 400
- [x] 6.17 Replacing a logo removes/deactivates the previous asset
- [x] 6.18 Cross-organization asset access returns 403/404
- [x] 6.19 Audit events are written for profile and asset changes
- [x] 6.20 `pnpm lint` and `tsc --noEmit` pass
