## 1. Drizzle Setup

- [x] 1.1 Create `packages/database/package.json` with name `@porteria/database`, drizzle-orm and drizzle-kit as dependencies
- [x] 1.2 Create `packages/database/tsconfig.json` extending root tsconfig.base.json with `composite: true`
- [x] 1.3 Create `packages/database/drizzle.config.ts` pointing to schema files and PostgreSQL connection
- [x] 1.4 Create `packages/database/src/connection.ts` exporting a `createDb` function using `pg` Pool
- [x] 1.5 Add `@porteria/shared` as workspace dependency for enums (UserRole, EventType, etc.)
- [x] 1.6 Verify `pnpm --filter @porteria/database exec tsc --noEmit` passes

## 2. Core Entity Tables

- [x] 2.1 Create `packages/database/src/schema/organizations.ts` — UUID pk, name (unique), timestamps
- [x] 2.2 Create `packages/database/src/schema/locations.ts` — UUID pk, name, address, timezone, organization_id FK, timestamps
- [x] 2.3 Create `packages/database/src/schema/access-points.ts` — UUID pk, name, type enum, gpio_pin, location_id FK, timestamps
- [x] 2.4 Create `packages/database/src/schema/kiosks.ts` — UUID pk, name, rpi_id, ip_address, status enum, access_point_id unique FK, last_heartbeat, timestamps

## 3. User Tables

- [x] 3.1 Create `packages/database/src/schema/users.ts` — UUID pk, email, password_hash, name, role enum, organization_id FK, location_id FK, active boolean, timestamps
- [x] 3.2 Create `packages/database/src/schema/visitors.ts` — UUID pk, name, document, type enum, photo_url, valid_from, valid_until, organization_id FK, created_by FK, timestamps
- [x] 3.3 Create `packages/database/src/schema/refresh-tokens.ts` — UUID pk, user_id FK, token_hash unique, expires_at, revoked, timestamps

## 4. Operational Tables

- [x] 4.1 Create `packages/database/src/schema/calls.ts` — UUID pk, kiosk_id FK, operator_id FK, organization_id FK, access_point_id FK, status enum, started_at, ended_at, duration
- [x] 4.2 Create `packages/database/src/schema/events.ts` — UUID pk, event_type text, actor_id, actor_role, organization_id FK, location_id FK, access_point_id FK, metadata jsonb, created_at. Configure TimescaleDB hypertable on `created_at` with 7-day chunks
- [x] 4.3 Create `packages/database/src/schema/guard-rounds.ts` — UUID pk, guard_id FK, location_id FK, name, scheduled_at, started_at, completed_at, status enum, timestamps
- [x] 4.4 Create `packages/database/src/schema/guard-checkpoints.ts` — UUID pk, round_id FK, name, order_index, scanned_at, timestamps
- [x] 4.5 Create `packages/database/src/schema/access-codes.ts` — UUID pk, code (unique), visitor_id FK, access_point_id FK, valid_from, valid_until, used_at, created_by FK, timestamps

## 5. Relations and Exports

- [x] 5.1 Create `packages/database/src/schema/relations.ts` defining Drizzle relations between tables
- [x] 5.2 Create `packages/database/src/schema/index.ts` as barrel export of all tables and relations
- [x] 5.3 Create `packages/database/src/index.ts` exporting schema and connection utility

## 6. Migration

- [x] 6.1 Run `pnpm --filter @porteria/database db:generate` to create initial migration SQL
- [x] 6.2 Run `pnpm --filter @porteria/database db:migrate` to apply migration to local PostgreSQL
- [x] 6.3 Verify via psql that all 12 tables exist in the `porteria` database
- [x] 6.4 Verify `events` table is a TimescaleDB hypertable: `SELECT * FROM timescaledb_information.hypertables WHERE hypertable_name = 'events';`

## 7. Seed Data

- [x] 7.1 Create `packages/database/src/seed.ts` script with bcrypt password hashing
- [x] 7.2 Seed creates demo organization "Edificio Demo" and location "Torre Principal"
- [x] 7.3 Seed creates access point "Puerta Principal" (type: door, gpio: 17) and kiosk "Kiosk-01"
- [x] 7.4 Seed creates 4 users: admin@porteria.local (admin), operador@porteria.local (operator), guardia@porteria.local (guard), residente@porteria.local (resident) — all with password "porteria123"
- [x] 7.5 Seed creates 2 sample visitors: one permanent, one temporary delivery
- [x] 7.6 Add `packages/database/package.json` script `db:seed` that runs the seed
- [x] 7.7 Run seed and verify data: query users table to confirm 4 users exist

## 8. Verification

- [x] 8.1 Verify all tables exist with correct columns: `psql -U porteria -d porteria -c "\dt"`
- [x] 8.2 Verify unique constraints work: attempt inserting duplicate email fails
- [x] 8.3 Verify foreign key constraints work: attempt inserting location with invalid org_id fails
- [x] 8.4 Verify TimescaleDB hypertable: `SELECT * FROM timescaledb_information.hypertables;`
- [x] 8.5 Verify seed data is complete and queryable
