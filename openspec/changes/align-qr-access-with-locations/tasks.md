## 1. Update the active QR change

- [ ] 1.1 Update `add-dynamic-qr-access` proposal with location/person/subuser references
- [ ] 1.2 Update design with validation and notification recipients
- [ ] 1.3 Update `dynamic-pass-creation` spec (`locationUnitId`, authorizer)
- [ ] 1.4 Update `pass-scan-entry` spec (location path, authorizer)
- [ ] 1.5 Update `pass-lifecycle` spec (notification recipients)
- [ ] 1.6 Update `database-schema` and `shared-types` specs
- [ ] 1.7 Update `tasks.md` with migration/regression tasks

## 2. Database migration

- [ ] 2.1 Add `location_unit_id`, `structure_id`, `created_by_person_id`,
  `authorized_by_person_id`, `authorized_by_delegation_id` to `access_passes`
- [ ] 2.2 Map legacy `unit_id` → `location_unit_id`
- [ ] 2.3 Quarantine/report unmapped passes
- [ ] 2.4 Add indexes/FKs
- [ ] 2.5 Add rollback notes

## 3. API

- [ ] 3.1 Validate leaf location and tenant on pass creation
- [ ] 3.2 Validate resident association or delegation permission
- [ ] 3.3 Store authorizer/delegation ids
- [ ] 3.4 Return location path and authorizer in scan
- [ ] 3.5 Persist location/authorizer snapshots in bitácora
- [ ] 3.6 Normalize `unitId` alias to `locationUnitId`
- [ ] 3.7 Update shared DTOs

## 4. Notifications

- [ ] 4.1 Resolve recipients from `location_residents` + accounts
- [ ] 4.2 Notify authorizer when different from resident
- [ ] 4.3 Keep guard/admin recipients for missing exit
- [ ] 4.4 Update pass notification data with location/structure

## 5. App Zima

- [ ] 5.1 Update pass creation to select a leaf location
- [ ] 5.2 Add authorizer selector for main/subusers
- [ ] 5.3 Show location path and authorizer in pass/scan detail

## 6. Verification

- [ ] 6.1 Main resident creates a pass for a leaf location
- [ ] 6.2 Subuser with permission creates a pass; traceability correct
- [ ] 6.3 Subuser without permission is rejected
- [ ] 6.4 Cross-tenant/non-leaf location rejected
- [ ] 6.5 Scan shows location path and authorizer
- [ ] 6.6 Notifications reach the correct residents
- [ ] 6.7 Legacy pass migration verified
- [ ] 6.8 Existing QR flow regression passes
- [ ] 6.9 `pnpm lint` and `tsc --noEmit` pass
