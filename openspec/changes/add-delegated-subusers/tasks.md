## 1. Schema and migration

- [ ] 1.1 Create `subuser_delegations` (main, subuser, relationship, mode, status, validity)
- [ ] 1.2 Create `subuser_permissions` (delegation, permission, granted)
- [ ] 1.3 Create `subuser_locations` (delegation, location_unit)
- [ ] 1.4 Add indexes/constraints
- [ ] 1.5 Generate and review the migration
- [ ] 1.6 Add rollback notes

## 2. Domain service

- [ ] 2.1 Implement create managed subuser (person without account)
- [ ] 2.2 Implement create account subuser (person + account)
- [ ] 2.3 Validate main user manages the locations
- [ ] 2.4 Implement permissions and location scope
- [ ] 2.5 Implement revoke and scope reduction
- [ ] 2.6 Implement authorizer resolution for passes
- [ ] 2.7 Add unit tests for escalation/scope/revocation

## 3. API

- [ ] 3.1 Add `GET/POST/PATCH /api/me/subusers`
- [ ] 3.2 Add `POST /api/me/subusers/:id/revoke`
- [ ] 3.3 Add permissions/locations update
- [ ] 3.4 Add authorizer list for pass creation
- [ ] 3.5 Enforce delegation scope in pass endpoints
- [ ] 3.6 Add audit events

## 4. Dashboard/app

- [ ] 4.1 Build subuser list/create/edit in the resident mode
- [ ] 4.2 Add permission switches
- [ ] 4.3 Add location scope selector
- [ ] 4.4 Add authorizer selector in pass creation
- [ ] 4.5 Show authorizer in pass/scan detail
- [ ] 4.6 Add empty/error/loading states

## 5. QR integration preparation

- [ ] 5.1 Add `authorized_by_person_id`/`authorized_by_delegation_id` fields in the pass
  model (coordinate with proposal 7)
- [ ] 5.2 Ensure pass creation validates delegation permission
- [ ] 5.3 Ensure bitácora shows main user and subuser
- [ ] 5.4 Ensure revocation affects new/pending passes per policy

## 6. Verification

- [ ] 6.1 Main user creates a managed subuser without email
- [ ] 6.2 Main user creates a subuser with account
- [ ] 6.3 Subuser with permission creates a pass; traceability is correct
- [ ] 6.4 Subuser without permission is rejected
- [ ] 6.5 Subuser cannot create another subuser
- [ ] 6.6 Revocation blocks new passes and filters scope
- [ ] 6.7 `pnpm lint` and `tsc --noEmit` pass
