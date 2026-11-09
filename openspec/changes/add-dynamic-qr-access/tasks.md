## 1. Shared types and DTOs

- [ ] 1.1 Add `PassType`, `PassStatus`, `PresenceState`, `ScanAction`, `ScanStatus`, `PassAlertType`, `PassAlertStatus` enums
- [ ] 1.2 Add `AccessPass`, `PassScan`, `PassAlert` types
- [ ] 1.3 Add `CreatePassDto`, `PassLinkResponse`, `BindPassDto`, `PublicPassPreview`, `PassStatusResponse`, `ScanPassResponse`
- [ ] 1.4 Export all new types/DTOs from `packages/shared/src/index.ts`

## 2. Database schema and migration

- [ ] 2.1 Create `schema/access-passes.ts` with columns and indexes
- [ ] 2.2 Create `schema/pass-scans.ts` with unique `token_jti`
- [ ] 2.3 Create `schema/pass-alerts.ts` with one open alert per pass/type
- [ ] 2.4 Add `topic` column to `schema/outbox-events.ts` (default `events`)
- [ ] 2.5 Update `relations.ts` and `schema/index.ts`
- [ ] 2.6 Generate and hand-check the migration
- [ ] 2.7 Backfill existing outbox rows to `topic = 'events'`
- [ ] 2.8 Apply the migration and verify tables/indexes

## 3. Pass creation service

- [ ] 3.1 Create `server/api/src/modules/passes/pass.service.ts`
- [ ] 3.2 Implement `createPass` with unit scope validation
- [ ] 3.3 Validate schedule (dates, allowed days, daily window, community timezone)
- [ ] 3.4 Validate `hasVehicle`/`vehiclePlate` and normalize plate
- [ ] 3.5 Validate optional 4-digit PIN and hash it
- [ ] 3.6 Generate link token (32 bytes), store SHA-256 hash
- [ ] 3.7 Implement `listPasses` and `getPassById` scoped to the resident
- [ ] 3.8 Implement `revokePass`
- [ ] 3.9 Implement `regenerateLink` (clear device binding)
- [ ] 3.10 Enforce per-unit daily pass limits

## 4. Pass API

- [ ] 4.1 Add `POST /api/passes`
- [ ] 4.2 Add `GET /api/passes`
- [ ] 4.3 Add `GET /api/passes/:id`
- [ ] 4.4 Add `POST /api/passes/:id/revoke`
- [ ] 4.5 Add `POST /api/passes/:id/regenerate-link`
- [ ] 4.6 Add `GET /api/passes/:id/qr` for the resident app
- [ ] 4.7 Enforce resident/admin RBAC and tenant scope

## 5. Public link and binding

- [ ] 5.1 Add `GET /api/public/passes/:token` preview (masked document)
- [ ] 5.2 Add `POST /api/public/passes/:token/bind` with optional PIN
- [ ] 5.3 Issue a signed HttpOnly device cookie for the pass
- [ ] 5.4 Reject a different device with 403
- [ ] 5.5 Add `GET /api/public/passes/:token/status`
- [ ] 5.6 Rate-limit bind/preview/status
- [ ] 5.7 Ensure the raw link token is never logged

## 6. Rotating QR

- [ ] 6.1 Implement signed QR token (passId, jti, iat, exp 24s)
- [ ] 6.2 Add `GET /api/public/passes/:token/qr` for the bound device
- [ ] 6.3 Allow exit tokens while `presence_state = inside`
- [ ] 6.4 Return `not_valid_now` + next window when outside the schedule
- [ ] 6.5 Ensure `jti` single-use via `pass_scans.token_jti` unique
- [ ] 6.6 Never persist or log raw QR tokens
- [ ] 6.7 Add token refresh/expiry tests

## 7. Scan and bitácora

- [ ] 7.1 Add `POST /api/access/scan` for guards/operators
- [ ] 7.2 Validate token signature/expiry, guard community, pass status, schedule
- [ ] 7.3 Decide action `entry` vs `exit` from `presence_state`
- [ ] 7.4 Create a pending `pass_scan` and consume the token `jti`
- [ ] 7.5 Return visitor data, vehicle plate, unit, authorizer, and schedule
- [ ] 7.6 Add `POST /api/access/scans/:id/confirm`
- [ ] 7.7 Add `POST /api/access/scans/:id/reject`
- [ ] 7.8 Update status/presence/timestamps atomically on confirm
- [ ] 7.9 Add `GET /api/access/scans` with pagination and guard filter
- [ ] 7.10 Prevent double confirmation with a conditional update
- [ ] 7.11 Enqueue `pass.*` events (topic events) and `notification.requested` (topic notifications) in the same transaction

## 8. Lifecycle and alerts

- [ ] 8.1 Implement pass status/presence transitions
- [ ] 8.2 Implement expiration evaluation
- [ ] 8.3 Implement recurring availability by day/time
- [ ] 8.4 Create `pass_alerts` for missing exits
- [ ] 8.5 Implement the missing-exit worker with configurable grace (15 min default)
- [ ] 8.6 Avoid duplicate open alerts
- [ ] 8.7 Resolve the alert on exit or manual admin action
- [ ] 8.8 Add alert audit events
- [ ] 8.9 Add retention policy for old passes/scans

## 9. Public pass-web app

- [ ] 9.1 Create `apps/pass-web` (Vite + React, mobile-first)
- [ ] 9.2 Add route `/p/:token` (nginx path)
- [ ] 9.3 Fetch preview and bind device with optional PIN
- [ ] 9.4 Render the rotating QR and refresh every 20–24 s
- [ ] 9.5 Show pass status, presence, schedule, and vehicle plate
- [ ] 9.6 Show used/expired/revoked/wrong-device states
- [ ] 9.7 Show “open this link on the phone you will present at the gate”
- [ ] 9.8 Add minimal styling and no dashboard bundle

## 10. Outbox topic routing

- [ ] 10.1 Add `topic` to the outbox schema/migration
- [ ] 10.2 Update main outbox worker to claim `topic = 'events'`
- [ ] 10.3 Update outbox stats to group by topic
- [ ] 10.4 Ensure `notification.requested` rows are not delivered to the event store
- [ ] 10.5 Add a test that both workers do not double-claim

## 11. Configuration and seed

- [ ] 11.1 Add `DYNAMIC_QR_ENABLED`, `PASS_QR_SECRET`, `PASS_LINK_TTL`, `PASS_PIN_ATTEMPTS`
- [ ] 11.2 Add `PASS_MISSING_EXIT_GRACE_MINUTES=15`
- [ ] 11.3 Add `PASS_ALERT_WORKER_ENABLED` and poll interval
- [ ] 11.4 Seed a demo pass and a demo link
- [ ] 11.5 Document the local pass-web URL and demo flow

## 12. Verification

- [ ] 12.1 Resident creates an `entry_only` pass and gets a link
- [ ] 12.2 Link binds to the first device and rejects a second device
- [ ] 12.3 PIN is required when enabled
- [ ] 12.4 QR rotates and an expired token is rejected
- [ ] 12.5 Guard scans and confirms entry; bitácora records it
- [ ] 12.6 Guard rejects; pass remains active
- [ ] 12.7 `entry_exit` registers entry and exit and becomes used
- [ ] 12.8 `entry_exit_recurring` allows a second cycle
- [ ] 12.9 Vehicle plate appears in scan, bitácora, and notification request
- [ ] 12.10 Missing exit creates an alert after the grace period
- [ ] 12.11 Regenerating the link unbinds the previous device
- [ ] 12.12 `pnpm lint` passes
- [ ] 12.13 `tsc --noEmit` passes for all packages
