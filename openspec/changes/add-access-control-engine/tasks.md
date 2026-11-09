## 1. Shared types and DTOs

- [ ] 1.1 Add `CredentialType` and `CredentialSubjectType` enums in `packages/shared/src/enums/`
- [ ] 1.2 Add `Credential`, `AccessRule`, `AccessPointPolicy`, `AccessDecision`, `AccessLog` types
- [ ] 1.3 Add `VerifyAccessRequest`, `VerifyAccessResponse`, `PolicySnapshot`, `PolicyDelta` DTOs
- [ ] 1.4 Export new types/enums/DTOs from `packages/shared/src/index.ts`

## 2. Database schema

- [ ] 2.1 Create `schema/credentials.ts` with enums, columns, and indexes
- [ ] 2.2 Create `schema/access-rules.ts` with schedule JSONB and indexes
- [ ] 2.3 Create `schema/access-logs.ts` with unique `(device_id, request_id)`
- [ ] 2.4 Add `fail_policy` and `direction` columns to `schema/access-points.ts`
- [ ] 2.5 Update `relations.ts` for credentials, rules, logs, access points
- [ ] 2.6 Update `schema/index.ts` exports

## 3. Migration

- [ ] 3.1 Generate `migrations/0004_access_control_engine.sql`
- [ ] 3.2 Add enums `credential_type`, `credential_subject_type`, `access_effect`, `access_decision`, `fail_policy`, `access_direction`
- [ ] 3.3 Create `credentials`, `access_rules`, `access_logs` with FKs and indexes
- [ ] 3.4 Add `fail_policy`/`direction` to `access_points` with defaults
- [ ] 3.5 Backfill `access_codes` rows into `credentials` type `qr`
- [ ] 3.6 Add a rollback comment block

## 4. Credential service

- [ ] 4.1 Implement `createCredential`, `revokeCredential`, `getCredentialById`
- [ ] 4.2 Implement PIN hashing/verification with Argon2id or bcrypt
- [ ] 4.3 Implement RFID/plate normalization helpers
- [ ] 4.4 Implement atomic `used_count` increment guarded by `max_uses`
- [ ] 4.5 Implement QR token issuance/verification helpers with Ed25519
- [ ] 4.6 Add credential validation (subject exists, community scope)

## 5. Rule evaluation engine

- [ ] 5.1 Implement `evaluateAccess(context, credential, rules, policy, now)` as a pure function
- [ ] 5.2 Implement deny-by-default and deny-wins precedence
- [ ] 5.3 Implement schedule evaluation in community timezone
- [ ] 5.4 Implement date-range and max-uses checks
- [ ] 5.5 Implement anti-passback lookup
- [ ] 5.6 Implement `dryRun` mode without actuation or real log
- [ ] 5.7 Add unit tests for allow, deny, out-of-schedule, max uses, anti-passback

## 6. Decision engine and verify endpoint

- [ ] 6.1 Create `server/api/src/modules/access/decision.service.ts`
- [ ] 6.2 Add `POST /api/internal/access/verify` with Zod validation
- [ ] 6.3 Implement device token authentication and community scope check
- [ ] 6.4 Implement `requestId` idempotency (cache + unique constraint handling)
- [ ] 6.5 Return `decision`, `reason`, `matchedRuleId`, `credentialId`, `actuated`, `rulesVersion`
- [ ] 6.6 Add rate limiting per device

## 7. Actuation

- [ ] 7.1 Define the `Actuator` interface (`actuate(request) → result`)
- [ ] 7.2 Implement `RelayActuator` calling `POST /api/internal/relays/trigger`
- [ ] 7.3 Pass `requestId` and `source = 'access'` end-to-end
- [ ] 7.4 Handle actuation failure and record `access.actuation_failed`
- [ ] 7.5 Add a feature flag to switch the actuator implementation

## 8. Audit

- [ ] 8.1 Insert an `access_logs` row for every decision (online and synced offline)
- [ ] 8.2 Emit `access.granted`, `access.denied`, `access.actuation_failed` events
- [ ] 8.3 Implement `GET /api/access-logs` with pagination and filters
- [ ] 8.4 Enforce role access (`org_admin`, `community_admin`, `operator`, `guard`)
- [ ] 8.5 Ensure logs never store raw secrets or templates

## 9. Offline policy

- [ ] 9.1 Implement `GET /api/internal/access/policy-snapshot`
- [ ] 9.2 Sign snapshots with Ed25519 and include `version`, `issuedAt`, `expiresAt`, `publicKey`
- [ ] 9.3 Implement `GET /api/internal/access/policy-delta?since=<version>`
- [ ] 9.4 Retain deltas for a configurable window and instruct full snapshot when too old
- [ ] 9.5 Implement offline log sync endpoint with `requestId` deduplication
- [ ] 9.6 Add `source = 'offline'` and `occurred_at` handling

## 10. Rule and access point management API

- [ ] 10.1 Add CRUD routes for `access_rules` (admin/community_admin)
- [ ] 10.2 Add CRUD routes for access point policy (`fail_policy`, `direction`)
- [ ] 10.3 Add `POST /api/access/simulate` dry-run endpoint
- [ ] 10.4 Increment `rulesVersion` on any rule change for the community

## 11. Seed and configuration

- [ ] 11.1 Add `.env` keys for access feature flag, snapshot TTL, and delta retention
- [ ] 11.2 Seed one allow rule and one deny rule for the demo community
- [ ] 11.3 Seed a demo QR credential for a resident
- [ ] 11.4 Seed a demo device token

## 12. Verification

- [ ] 12.1 Verify allow decision actuates the relay once and logs `access.granted`
- [ ] 12.2 Verify deny decision does not actuate and logs `access.denied`
- [ ] 12.3 Verify duplicate `requestId` does not double-actuate
- [ ] 12.4 Verify max uses rejects the second use with `max_uses_reached`
- [ ] 12.5 Verify out-of-schedule and expired credentials are denied
- [ ] 12.6 Verify snapshot signature and tamper rejection
- [ ] 12.7 Verify offline log sync reconciles correctly
- [ ] 12.8 Run `pnpm lint` and `tsc --noEmit`
