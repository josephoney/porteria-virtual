## 1. Shared types

- [ ] 1.1 Add `PassType` and `PassStatus` enums
- [ ] 1.2 Add `AccessPass`, `AccessPassPoint`, `PassTokenResponse`, `ScanPassResponse` types
- [ ] 1.3 Add `CreateAccessPassDto` and `RegeneratePassTokenDto`
- [ ] 1.4 Export from `packages/shared/src/index.ts`

## 2. Database schema and migration

- [ ] 2.1 Create `schema/access-passes.ts`
- [ ] 2.2 Create the `access_pass_points` join table
- [ ] 2.3 Add unique constraint on `credential_id`
- [ ] 2.4 Add indexes on `(community_id, status, valid_until)` and `(unit_id, created_at DESC)`
- [ ] 2.5 Generate and check the migration with rollback comments
- [ ] 2.6 Backfill legacy `access_codes` where possible

## 3. Pass service

- [ ] 3.1 Implement `createPass` (resident, guard, admin scopes)
- [ ] 3.2 Validate unit membership and community scope
- [ ] 3.3 Apply per-type defaults
- [ ] 3.4 Create the linked `qr` credential via the access engine credential service
- [ ] 3.5 Implement `revokePass` and credential revocation
- [ ] 3.6 Implement `regenerateToken` with `jti` rotation
- [ ] 3.7 Implement atomic usage increment
- [ ] 3.8 Implement expiration evaluation

## 4. Issuance API

- [ ] 4.1 Add `POST /api/access-passes`
- [ ] 4.2 Add `POST /api/access-passes/:id/token`
- [ ] 4.3 Add `POST /api/access-passes/:id/revoke`
- [ ] 4.4 Add `GET /api/access-passes` with filters and pagination
- [ ] 4.5 Add `GET /api/access-passes/:id`
- [ ] 4.6 Enforce RBAC and unit scope
- [ ] 4.7 Apply per-unit daily rate limits

## 5. Validation and scan

- [ ] 5.1 Add `POST /api/internal/access/scan` with device auth
- [ ] 5.2 Decode the token and forward to the decision engine
- [ ] 5.3 Map pass states to deny reasons (`expired`, `revoked`, `max_uses_reached`, `out_of_scope`)
- [ ] 5.4 Ensure the raw token is never stored or logged
- [ ] 5.5 Record `access_logs` with `passId` and `jti`
- [ ] 5.6 Emit `pass.used` event

## 6. Notifications

- [ ] 6.1 Emit `visitor_arrived` on first valid visitor pass use
- [ ] 6.2 Emit `delivery_arrived` on delivery pass use
- [ ] 6.3 Avoid duplicate arrival notifications for multi-use passes
- [ ] 6.4 Respect notification preferences for non-critical types

## 7. Offline

- [ ] 7.1 Include pass/credential `jti` and revocation in the policy snapshot/delta
- [ ] 7.2 Verify token signature and expiration locally
- [ ] 7.3 Apply `fail_policy` when the snapshot is expired
- [ ] 7.4 Sync offline scan logs with `requestId` deduplication

## 8. Audit

- [ ] 8.1 Emit `pass.created`, `pass.used`, `pass.revoked`, `pass.expired`
- [ ] 8.2 Emit `pass.issue_rejected` for rate limits
- [ ] 8.3 Ensure audit events contain no raw tokens or sensitive holder data

## 9. Configuration and seed

- [ ] 9.1 Add `QR_PASSES_ENABLED` and per-type default env/config
- [ ] 9.2 Add per-unit daily pass limit config
- [ ] 9.3 Seed a demo visitor pass for the demo community

## 10. Verification

- [ ] 10.1 Resident creates a pass for their unit and gets a token
- [ ] 10.2 Resident cannot create a pass for another unit
- [ ] 10.3 Scan an active pass and verify allow + `pass.used`
- [ ] 10.4 Scan an expired/revoked/single-use pass and verify deny
- [ ] 10.5 Regenerate token invalidates the previous one
- [ ] 10.6 Verify offline scan and revocation propagation
- [ ] 10.7 Verify arrival notification on first use only
- [ ] 10.8 Run `pnpm lint` and `tsc --noEmit`
