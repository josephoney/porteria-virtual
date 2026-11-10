# Tasks

## 1. Shared types and DTOs

- [x] 1.1 Add `GuardShiftStatus`, `BitacoraEntryType`, `BitacoraSource` and
      `AccessPointDirection` enums
- [x] 1.2 Add `AccessPoint`, `GuardShift`, `GuardShiftSegment`, `BitacoraEntry` and
      `BitacoraComment` types
- [x] 1.3 Add `AccessPointDto`, `CreateAccessPointDto`, `UpdateAccessPointDto`,
      `GuardShiftCurrentResponse`, `StartShiftDto`, `ChangeAccessPointDto`,
      `BitacoraEntryDto`, `BitacoraEntryDetailDto`, `CreateBitacoraEntryDto`,
      `CreateBitacoraCommentDto` and list response DTOs
- [x] 1.4 Add `accessPointId`, `accessPointName`, `shiftId` and `bitacoraEntryId` to
      `ScanPassResponse`/`ScanDecisionResponse`
- [x] 1.5 Add `defaultAccessPointId` to `MembershipSummary`
- [x] 1.6 Export everything from `packages/shared/src/index.ts`

## 2. Database schema and migration

- [x] 2.1 Add `active` and make `gpio_pin` nullable in `access-points.ts`; add unique
      `(community_id, name)`
- [x] 2.2 Add `default_access_point_id` to `memberships.ts`
- [x] 2.3 Create `guard-shifts.ts` with the partial unique open shift per guard
- [x] 2.4 Create `guard-shift-segments.ts` with the partial unique open segment per shift
- [x] 2.5 Create `bitacora-entries.ts` with `access_point_name` snapshot and indexes
- [x] 2.6 Create `bitacora-comments.ts` with the entry index
- [x] 2.7 Add `shift_id`, `access_point_id`, `access_point_name`,
      `confirmed_by_person_id` and `confirmed_by_account_id` to `pass-scans.ts`
- [x] 2.8 Update `relations.ts` and `schema/index.ts`
- [x] 2.9 Generate and hand-check the migration
- [x] 2.10 Add the `BEFORE UPDATE` immutability trigger for bitácora entries/comments
- [x] 2.11 Apply the migration and verify tables, indexes and trigger

## 3. Access point management

- [x] 3.1 Create `access-point.service.ts` with list, create, update and deactivate
- [x] 3.2 Validate name uniqueness per community and community scope
- [x] 3.3 Add routes under `/api/communities/:communityId/access-points`
- [x] 3.4 Guard can list active access points; admin can list all and mutate
- [x] 3.5 Add access point selector data to the membership/admin UI

## 4. Guard shifts

- [x] 4.1 Create `guard-shift.service.ts`
- [x] 4.2 Implement `getCurrentShift` with open shift, open segment and access point
- [x] 4.3 Implement `startShift` with default access point and idempotent open shift
- [x] 4.4 Implement `changeAccessPoint` closing the old segment and opening the new one
- [x] 4.5 Implement `endShift` closing segment and shift
- [x] 4.6 Implement `forceCloseShift` for community/org admins
- [x] 4.7 Add `shift_start`/`shift_end` bitácora entries with `reassigned` reason
- [x] 4.8 Add `GET/POST /api/guard/shifts` routes and guard-only RBAC
- [x] 4.9 Add `GUARD_SHIFT_MAX_HOURS` and stale flag
- [x] 4.10 Add `default_access_point_id` to membership create/update and DTOs

## 5. Access bitácora

- [x] 5.1 Create `bitacora.service.ts` with list, detail, manual create and comment
- [x] 5.2 Implement scope: guard by worked access points, admin by community/org,
      platform read-only
- [x] 5.3 Mask document in list responses; full detail only for authorized roles
- [x] 5.4 Add routes `GET /api/bitacora`, `GET /api/bitacora/:id`,
      `POST /api/bitacora`, `POST /api/bitacora/:id/comments`
- [x] 5.5 Forbid `PATCH`/`DELETE` and test the DB trigger
- [x] 5.6 Add `insertBitacoraEntry` helper for use inside transactions

## 6. Scan integration

- [x] 6.1 Require an open shift and open segment in `scanPass`
- [x] 6.2 Store `shift_id`, `access_point_id` and `access_point_name` in `pass_scans`
- [x] 6.3 Validate access point direction (`entry`/`exit`/`both`)
- [x] 6.4 Write `scan_denied` entries for policy denials and invalid/foreign tokens
- [x] 6.5 Require the confirmer/rejecter to have an open segment at the same access point
- [x] 6.6 Record `confirmed_by_person_id`/`confirmed_by_account_id`
- [x] 6.7 Write `pass_entry`/`pass_exit`/`pass_rejected` entries in the same transaction
- [x] 6.8 Return `accessPointId`, `accessPointName`, `shiftId` and `bitacoraEntryId`
- [x] 6.9 Change scan/confirm/reject routes to `requireRole('guard')`

## 7. Dashboard

- [x] 7.1 Replace `GuardPanel.tsx` with the real guard panel
- [x] 7.2 Add personal info, current shift, start/change/end actions
- [x] 7.3 Add bitácora feed, manual entry form and comments
- [x] 7.4 Add admin access points page with CRUD
- [x] 7.5 Add Bitácora de accesos page with community/access/date filters
- [x] 7.6 Rename the current Bitácora page to Auditoría and update its route
- [x] 7.7 Update sidebar and route guards
- [x] 7.8 Add active guards per access point for admins
- [ ] 7.9 Add Playwright coverage for guard panel and bitácora

## 8. Zima guard mode

- [x] 8.1 Add shift API client
- [x] 8.2 Add current-shift gate and access point selection
- [x] 8.3 Add start/change/end shift screens
- [x] 8.4 Add scan with `accessPointName` in the result
- [x] 8.5 Add confirm/reject and 409 handling
- [x] 8.6 Add shift history and personal info
- [x] 8.7 Change `operator` to `no-mode`; guard-only mode
- [x] 8.8 Update Zima specs and README

## 9. Tests and documentation

- [ ] 9.1 Unit tests for shift state machine and access point validation
- [x] 9.2 Integration tests for shifts, access points, bitácora and permissions
- [x] 9.3 Integration tests for scan with shift, access point, direction and denials
- [x] 9.4 Integration test for bitácora immutability
- [x] 9.5 Verify no raw QR/link tokens in logs or bitácora
- [x] 9.6 Update `add-dynamic-qr-access` and `add-zima-qr-access-app` specs
- [x] 9.7 Run `pnpm lint`, `tsc --noEmit`, Prettier and `openspec validate --strict`
- [x] 9.8 Update the guard/bitácora runbook and docs
