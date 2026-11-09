## 1. Shared types

- [x] 1.1 Add `OutboxStatus` enum and `OutboxStats` type
- [x] 1.2 Add `EventEnvelope` type and `createEventEnvelope()` helper
- [x] 1.3 Export new types from `packages/shared/src/index.ts`

## 2. Database schema and migration

- [x] 2.1 Create `schema/outbox-events.ts` with enums, columns, and indexes
- [x] 2.2 Add unique constraint on `event_id`
- [x] 2.3 Generate and hand-check `migrations/0006_event_outbox.sql`
- [x] 2.4 Add index on `(status, available_at)` and retention helper index
- [x] 2.5 Add rollback comment block

## 3. Outbox writer

- [x] 3.1 Implement `enqueueEvent(tx, envelope)` that accepts a transaction
- [x] 3.2 Use it inside domain transactions (users, access, calls)
- [x] 3.3 Add `POST /api/internal/outbox` idempotent by `eventId`
- [x] 3.4 Add Zod validation for the envelope

## 4. Idempotent ingestion

- [x] 4.1 Make `/api/internal/events` idempotent by `eventId`
- [x] 4.2 Return 201 for new, 200 for duplicate
- [x] 4.3 Add unique index/constraint on `events.event_id` (or dedupe table)
- [x] 4.4 Require `eventId` in the internal payload

## 5. Worker

- [x] 5.1 Implement `server/api/src/workers/outbox.worker.ts`
- [x] 5.2 Claim batches with `FOR UPDATE SKIP LOCKED`
- [x] 5.3 Deliver events to the internal ingestion path
- [x] 5.4 Implement exponential backoff with jitter
- [x] 5.5 Implement max attempts and dead-letter
- [x] 5.6 Start/stop the worker with the API (`OUTBOX_WORKER_ENABLED`)
- [x] 5.7 Ensure graceful shutdown releases `processing` rows

## 6. Dead-letter and replay

- [x] 6.1 Add `GET /api/internal/outbox/dead`
- [x] 6.2 Add `POST /api/internal/outbox/:id/replay`
- [x] 6.3 Add bulk replay with a maximum batch
- [x] 6.4 Audit replays with the admin id

## 7. Observability and retention

- [x] 7.1 Add `GET /api/internal/outbox/stats`
- [x] 7.2 Emit a warning when `oldestPendingAge` exceeds threshold
- [x] 7.3 Add a purge job for `done` rows older than the retention window
- [x] 7.4 Add structured logs with `eventId`, `eventType`, `attempts`

## 8. Signaling migration

- [x] 8.1 Add `@porteria/database` to `server/signaling/package.json`
- [x] 8.2 Create a database connection in signaling
- [x] 8.3 Replace `persistEvent` HTTP calls with outbox writes
- [x] 8.4 Keep call persistence behavior and event payloads
- [x] 8.5 Handle DB unavailability without blocking the call flow

## 9. Configuration

- [x] 9.1 Add `OUTBOX_WORKER_ENABLED`, batch size, poll interval, max attempts, retention env keys
- [x] 9.2 Document defaults

## 10. Verification

- [x] 10.1 Stop the API, produce an event from signaling, start the API and verify delivery
- [x] 10.2 Verify duplicate delivery does not create duplicate events
- [x] 10.3 Force 5xx responses and verify backoff
- [x] 10.4 Force a permanent 4xx and verify dead-letter
- [x] 10.5 Replay a dead event and verify delivery
- [x] 10.6 Verify metrics and lag warning
- [x] 10.7 Run `pnpm lint` and `tsc --noEmit`
