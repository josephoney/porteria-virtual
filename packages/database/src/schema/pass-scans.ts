import {
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { accounts } from './accounts';
import { accessPasses } from './access-passes';
import { accessPoints } from './access-points';
import { communities } from './communities';
import { guardShifts } from './guard-shifts';
import { locationStructures } from './location-structures';
import { locationUnits } from './location-units';
import { people } from './people';

export const scanActionEnum = pgEnum('scan_action', ['entry', 'exit']);

export const scanStatusEnum = pgEnum('scan_status', [
  'pending',
  'confirmed',
  'rejected',
  'expired',
]);

export const scanResultEnum = pgEnum('scan_result', ['authorized', 'denied']);

export const passScans = pgTable(
  'pass_scans',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    passId: uuid('pass_id')
      .notNull()
      .references(() => accessPasses.id, { onDelete: 'cascade' }),
    guardPersonId: uuid('guard_person_id')
      .notNull()
      .references(() => people.id, { onDelete: 'restrict' }),
    guardAccountId: uuid('guard_account_id').references(() => accounts.id, {
      onDelete: 'set null',
    }),
    shiftId: uuid('shift_id').references(() => guardShifts.id, {
      onDelete: 'set null',
    }),
    accessPointId: uuid('access_point_id').references(() => accessPoints.id, {
      onDelete: 'set null',
    }),
    accessPointName: varchar('access_point_name', { length: 255 }),
    confirmedByPersonId: uuid('confirmed_by_person_id').references(() => people.id, {
      onDelete: 'set null',
    }),
    confirmedByAccountId: uuid('confirmed_by_account_id').references(() => accounts.id, {
      onDelete: 'set null',
    }),
    communityId: uuid('community_id')
      .notNull()
      .references(() => communities.id, { onDelete: 'cascade' }),
    locationUnitId: uuid('location_unit_id')
      .notNull()
      .references(() => locationUnits.id, { onDelete: 'restrict' }),
    structureId: uuid('structure_id')
      .notNull()
      .references(() => locationStructures.id, { onDelete: 'restrict' }),
    visitorFirstName: varchar('visitor_first_name', { length: 120 }).notNull(),
    visitorLastName: varchar('visitor_last_name', { length: 120 }).notNull(),
    visitorDocument: varchar('visitor_document', { length: 50 }).notNull(),
    vehiclePlate: varchar('vehicle_plate', { length: 20 }),
    action: scanActionEnum('action').notNull(),
    result: scanResultEnum('result').notNull().default('authorized'),
    reason: text('reason'),
    tokenJti: uuid('token_jti').notNull(),
    status: scanStatusEnum('status').notNull().default('pending'),
    scannedAt: timestamp('scanned_at', { withTimezone: true }).defaultNow().notNull(),
    confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
  },
  (table) => ({
    tokenJtiIdx: uniqueIndex('pass_scan_token_jti_idx').on(table.tokenJti),
    passScannedIdx: index('pass_scan_pass_scanned_idx').on(table.passId, table.scannedAt),
    communityScannedIdx: index('pass_scan_community_scanned_idx').on(
      table.communityId,
      table.scannedAt,
    ),
    statusScannedIdx: index('pass_scan_status_scanned_idx').on(table.status, table.scannedAt),
    accessPointScannedIdx: index('pass_scan_access_point_scanned_idx').on(
      table.accessPointId,
      table.scannedAt,
    ),
    shiftScannedIdx: index('pass_scan_shift_scanned_idx').on(table.shiftId, table.scannedAt),
  }),
);
