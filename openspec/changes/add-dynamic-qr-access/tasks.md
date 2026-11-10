# Tasks

## MVP

### 1. Shared types and DTOs

- [x] 1.1 Add `PassType`, `PassStatus`, `PresenceState`, `ScanAction`, `ScanStatus`,
      `ScanResult`, `PassAlertType`, and `PassAlertStatus` enums
- [x] 1.2 Add `AccessPass`, `PassScan`, and `PassAlert` types with `locationUnitId`,
      `structureId`, `createdByPersonId`, `authorizedByPersonId`, `guardPersonId`, and
      `guardAccountId`
- [x] 1.3 Add `CreatePassDto` with `locationUnitId` (no `unitId`/`communityId`),
      `PassLinkResponse`, `BindPassDto`, `PublicPassPreview` with `locationPath`,
      `PassStatusResponse`, and `ScanPassResponse`
- [x] 1.4 Export all new types/DTOs from `packages/shared/src/index.ts`

### 2. Database schema and migration

- [x] 2.1 Create `schema/access-passes.ts` with `location_unit_id`, `structure_id`,
      `created_by_person_id`, `authorized_by_person_id`, `authorized_by_delegation_id`
      (nullable, no FK), `link_expires_at`, and PIN lockout columns
- [x] 2.2 Add unique index on `link_token_hash`; add `(community_id, status)`,
      `(location_unit_id, created_at DESC)`, and
      `(valid_until) WHERE status = 'active'`
- [x] 2.3 Create `schema/pass-scans.ts` with `guard_person_id`, `guard_account_id`,
      `location_unit_id`, `structure_id`, and unique `token_jti`; add the scan indexes
- [x] 2.4 Create `schema/pass-alerts.ts` with the partial unique index
      `(pass_id, type) WHERE status = 'open'`
- [x] 2.5 Add `topic` column to `schema/outbox-events.ts` (default `events`) and the
      `(topic, status, available_at)` index
- [x] 2.6 Update `relations.ts` and `schema/index.ts`
- [x] 2.7 Generate and hand-check the migration
- [x] 2.8 Apply the migration and verify tables/indexes

### 3. Pass creation service

- [x] 3.1 Create `server/api/src/services/pass.service.ts`
- [x] 3.2 Implement `createPass` resolving `communityId` and `structureId` from
      `locationUnitId`
- [x] 3.3 Validate that the unit is a leaf and belongs to the resident's community
- [x] 3.4 Validate the resident association through an active membership (person + leaf unit)
- [x] 3.5 Set `created_by_person_id` and `authorized_by_person_id`; set
      `authorized_by_delegation_id = NULL`
- [x] 3.6 Reject `entry_exit_recurring` with 400 `recurring_not_available`
- [x] 3.7 Validate schedule (dates, optional daily window, community timezone)
- [x] 3.8 Validate `hasVehicle`/`vehiclePlate` and normalize plate
- [x] 3.9 Validate optional 4-digit PIN and hash it
- [x] 3.10 Generate link token (32 bytes), store SHA-256 hash, set `link_expires_at`
- [x] 3.11 Implement `listPasses` and `getPassById` scoped to the resident, returning
      `locationPath`
- [x] 3.12 Implement `revokePass`
- [x] 3.13 Implement `regenerateLink` (clear device binding and PIN attempts)
- [x] 3.14 Enforce per-unit daily pass limits (config `PASS_DAILY_LIMIT_PER_UNIT`, default 20; 429 `daily_limit_reached`)

### 4. Pass API

- [x] 4.1 Add `POST /api/passes`
- [x] 4.2 Add `GET /api/passes`
- [x] 4.3 Add `GET /api/passes/:id`
- [x] 4.4 Add `POST /api/passes/:id/revoke`
- [x] 4.5 Add `POST /api/passes/:id/regenerate-link`
- [x] 4.6 Add `GET /api/passes/:id/qr` for the resident app
- [x] 4.7 Enforce resident/admin RBAC and tenant scope
- [x] 4.8 Return 410 `link_expired` for expired links

### 5. Public link and binding

- [x] 5.1 Add `GET /api/public/passes/:token` preview with masked document and
      `locationPath`
- [x] 5.2 Add `POST /api/public/passes/:token/bind` with optional PIN
- [x] 5.3 Issue the `pass_device` cookie: HttpOnly, Secure in production,
      SameSite=Lax, Path=/api/public/passes, Max-Age tied to the link TTL
- [x] 5.4 Reject a different device with 403 without revealing visitor data
- [x] 5.5 Add `GET /api/public/passes/:token/status`
- [x] 5.6 Implement PIN lockout: 5 attempts / 15 minutes, reset on success or regenerate
- [x] 5.7 Rate-limit bind/preview/status (in-memory per IP+token; 429 `rate_limited`)
- [x] 5.8 Ensure the raw link token is never logged

### 6. Rotating QR

- [x] 6.1 Implement the HS256 JWT with `PASS_QR_SECRET`, payload `{ v: 1, passId }`,
      `jti`, `iat`, `exp`
- [x] 6.2 Add `GET /api/public/passes/:token/qr` for the bound device
- [x] 6.3 Allow exit tokens while `presence_state = inside`
- [x] 6.4 Return `not_valid_now` + next window when outside the schedule
- [x] 6.5 Return 410 `pass_used` / `pass_not_active` and stop refresh
- [x] 6.6 Ensure `jti` single-use via `pass_scans.token_jti` unique
- [x] 6.7 Never persist or log raw QR tokens
- [x] 6.8 Add token refresh/expiry tests

### 7. Scan and bitácora

- [x] 7.1 Add `POST /api/access/scan` for guards/operators
- [x] 7.2 Validate token signature/expiry, guard community, pass status, schedule
- [x] 7.3 Deny `pass_used` without creating a pending scan
- [x] 7.4 Decide action `entry` vs `exit` from `presence_state`
- [x] 7.5 Create a pending `pass_scan` with `guard_person_id`, `guard_account_id`,
      `location_unit_id`, and `structure_id`; consume the token `jti`
- [x] 7.6 Return visitor data, vehicle plate, `locationPath`, authorizer, and schedule
- [x] 7.7 Add `POST /api/access/scans/:id/confirm`
- [x] 7.8 Add `POST /api/access/scans/:id/reject`
- [x] 7.9 Update status/presence/timestamps atomically on confirm
- [x] 7.10 Transition pending scans to `expired` after `PASS_SCAN_PENDING_TTL_SECONDS`;
      return 409 `scan_expired`
- [x] 7.11 Add `GET /api/access/scans` with pagination and guard filter
- [x] 7.12 Prevent double confirmation with a conditional update
- [x] 7.13 Enqueue `pass.*` events with topic `events` in the same transaction
- [x] 7.14 Remove `community_admin` from the scan guard; only `guard` and `operator`

### 8. Lifecycle (MVP subset)

- [x] 8.1 Implement pass status/presence transitions
- [x] 8.2 Implement expiration evaluation
- [x] 8.3 Ensure `entry_only` becomes `used` after entry
- [x] 8.4 Ensure `entry_exit` becomes `used` after exit
- [x] 8.5 Keep `pass_alerts` empty; no missing-exit worker in the MVP
- [x] 8.6 Add `DYNAMIC_QR_ENABLED` global guard; disabled returns 404/503

### 9. Public pass-web app

- [x] 9.1 Create `apps/pass-web` (Vite + React, mobile-first)
- [x] 9.2 Add route `/p/:token` served same-site via nginx path
- [x] 9.3 Fetch preview and bind device with optional PIN
- [x] 9.4 Render the rotating QR and refresh every 20â€“24 s
- [x] 9.5 Show pass status, presence, schedule, `locationPath`, and vehicle plate
- [x] 9.6 Show used/expired/revoked/wrong-device/link-expired states
- [x] 9.7 Show the â€œopen this link on the phone you will present at the gateâ€ notice
- [x] 9.8 Add minimal styling and no dashboard bundle

### 10. Outbox topic routing (MVP subset)

- [x] 10.1 Add `topic` to the outbox schema/migration
- [ ] 10.2 Update the main outbox worker to claim `topic = 'events'`
- [ ] 10.3 Update outbox stats to group by topic
- [ ] 10.4 Add a test that the main worker ignores non-`events` rows

### 11. Configuration and seed

- [x] 11.1 Add `DYNAMIC_QR_ENABLED=false`, `PASS_QR_SECRET`,
      `PASS_QR_TTL_SECONDS=24`, `PASS_LINK_TTL_MINUTES=1440`
- [x] 11.2 Add `PASS_PIN_ATTEMPTS=5`, `PASS_PIN_LOCK_MINUTES=15`
- [x] 11.3 Add `PASS_SCAN_PENDING_TTL_SECONDS=120`
- [x] 11.4 Add `PASS_MISSING_EXIT_GRACE_MINUTES=15` (reserved, unused in MVP)
- [ ] 11.5 Seed a demo pass and a demo link
- [x] 11.6 Document the local pass-web URL and demo flow

### 12. Automated tests and verification

- [x] 12.1 Unit tests for schedule, leaf validation, PIN lockout, and token signing
- [x] 12.2 Integration tests for create/list/revoke/regenerate
- [x] 12.3 Integration tests for preview/bind/status and second-device 403
- [x] 12.4 Integration tests for QR refresh, expiry, replay 409, and used 410
- [x] 12.5 Integration tests for scan/confirm/reject/expired scan
- [x] 12.6 Playwright E2E: resident creates an `entry_only` pass, visitor opens the link,
      guard scans and confirms
- [x] 12.7 Playwright E2E: `entry_exit` entry and exit
- [x] 12.8 Verify no raw link token or QR token appears in logs
- [x] 12.9 `pnpm lint` passes
- [x] 12.10 `tsc --noEmit` passes for all packages

## Phase 2 (deferred)

### 13. Push notifications

- [ ] 13.1 Implement `add-notification-service` (tables, templates, preferences, worker)
- [ ] 13.2 Emit `notification.requested` with topic `notifications` on entry, exit,
      rejection, and missing exit
- [ ] 13.3 Register Expo push devices and deep links
- [ ] 13.4 Enable the notification worker and test `FOR UPDATE SKIP LOCKED`

### 14. Subusers and delegation

- [ ] 14.1 Implement `add-delegated-subusers` (tables, permissions, `/api/me/subusers`)
- [ ] 14.2 Add the FK for `authorized_by_delegation_id`
- [ ] 14.3 Validate `authorize_visitors` and location scope during pass creation
- [ ] 14.4 Show the subuser authorizer in the scan and bitácora

### 15. Recurring passes

- [ ] 15.1 Enable creation of `entry_exit_recurring`
- [ ] 15.2 Evaluate `allowed_days` (0-6, 0=Sunday) in the community timezone
- [ ] 15.3 Implement cycles, overlap rules, and DST handling
- [ ] 15.4 Keep the pass `active` after each exit until `valid_until`

### 16. Missing-exit alerts

- [ ] 16.1 Enable the missing-exit worker with `PASS_MISSING_EXIT_GRACE_MINUTES`
- [ ] 16.2 Deduplicate open alerts with the partial unique index
- [ ] 16.3 Resolve alerts on exit or manual admin action
- [ ] 16.4 Send notifications to resident, guard, and `community_admin`

### 17. Dashboard and operations

- [ ] 17.1 Moved to `add-guard-shifts-and-access-bitacora` (Bitácora de accesos over
      `bitacora_entries`)
- [ ] 17.2 Move `DYNAMIC_QR_ENABLED` to per-community configuration
- [ ] 17.3 Define PII retention for passes and scans
- [ ] 17.4 Persist denied scan attempts
- [ ] 17.5 Add the operational runbook for link/QR incidents
