## 1. Schema and migration

- [x] 1.1 Create `people` with identity fields and unique document constraint
- [x] 1.2 Create `accounts` with unique email and person FK
- [x] 1.3 Add `person_id` to memberships and backfill
- [x] 1.4 Migrate `users` → people + accounts
- [x] 1.5 Migrate `created_by`/`operator_id`/`actor_id` references
- [x] 1.6 Keep a `userId → personId` map and revoke refresh tokens
- [x] 1.7 Add rollback and verification scripts
- [x] 1.8 Add `organizations.legal_representative_person_id` referencing people
- [x] 1.9 Add a partial unique index for normalized NIT when present

## 2. Auth

- [x] 2.1 Login by account email
- [x] 2.2 Add `personId`/`accountId` to token claims
- [x] 2.3 Update refresh/context to preserve person/account
- [x] 2.4 Reject legacy tokens
- [x] 2.5 Update platform admin flag handling
- [x] 2.6 Add auth tests

## 3. APIs

- [x] 3.1 Add person create/list/update
- [x] 3.2 Add account create/deactivate
- [x] 3.3 Add person detail with associations
- [x] 3.4 Deduplicate by document/contact email
- [x] 3.5 Mask document/phone in lists
- [x] 3.6 Never return password hash
- [x] 3.7 Add audit events

## 4. Associations

- [x] 4.1 Update memberships to `person_id`
- [x] 4.2 Update invitations to person/account
- [x] 4.3 Update users/memberships listing
- [x] 4.4 Update reports/actor joins
- [x] 4.5 Add regression tests
- [x] 4.6 Resolve the organization administrator from active `org_admin` membership + person
- [x] 4.7 Allow a person without account to be a legal representative
- [x] 4.8 Test person reuse across administrator and legal-representative roles

## 5. Dashboard/app

- [x] 5.1 Update user forms to person + account
- [x] 5.2 Show person names and roles
- [x] 5.3 Update auth context types (`accountId`, `personId`)
- [x] 5.4 Update Zima app auth types
- [x] 5.5 Update invitations page

## 6. Verification

- [x] 6.1 Migration counts match
- [x] 6.2 Login works for migrated accounts
- [x] 6.3 A person with two communities has one person row
- [x] 6.4 A person without account has associations but cannot log in
- [x] 6.5 Duplicate document/email handling
- [x] 6.6 `pnpm lint` and `tsc --noEmit` pass
