import {
  index,
  jsonb,
  pgEnum,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { accessPasses } from './access-passes';
import { accessPoints } from './access-points';
import { accounts } from './accounts';
import { communities } from './communities';
import { guardShifts } from './guard-shifts';
import { passScans } from './pass-scans';
import { people } from './people';

export const bitacoraEntryTypeEnum = pgEnum('bitacora_entry_type', [
  'pass_entry',
  'pass_exit',
  'pass_rejected',
  'scan_denied',
  'shift_start',
  'shift_end',
  'manual',
]);

export const bitacoraSourceEnum = pgEnum('bitacora_source', [
  'app',
  'dashboard',
  'system',
]);

export const bitacoraEntries = pgTable(
  'bitacora_entries',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    communityId: uuid('community_id')
      .notNull()
      .references(() => communities.id, { onDelete: 'cascade' }),
    accessPointId: uuid('access_point_id')
      .notNull()
      .references(() => accessPoints.id, { onDelete: 'restrict' }),
    accessPointName: varchar('access_point_name', { length: 255 }).notNull(),
    shiftId: uuid('shift_id').references(() => guardShifts.id, {
      onDelete: 'set null',
    }),
    type: bitacoraEntryTypeEnum('type').notNull(),
    source: bitacoraSourceEnum('source').notNull().default('app'),
    authorPersonId: uuid('author_person_id').references(() => people.id, {
      onDelete: 'set null',
    }),
    authorAccountId: uuid('author_account_id').references(() => accounts.id, {
      onDelete: 'set null',
    }),
    passId: uuid('pass_id').references(() => accessPasses.id, {
      onDelete: 'set null',
    }),
    passScanId: uuid('pass_scan_id').references(() => passScans.id, {
      onDelete: 'set null',
    }),
    summary: varchar('summary', { length: 500 }).notNull(),
    details: jsonb('details').default(sql`'{}'::jsonb`).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    placeCreatedIdx: index('bitacora_place_created_idx').on(
      table.communityId,
      table.accessPointId,
      table.createdAt,
    ),
    shiftCreatedIdx: index('bitacora_shift_created_idx').on(
      table.shiftId,
      table.createdAt,
    ),
    passIdx: index('bitacora_pass_idx').on(table.passId),
    typeCreatedIdx: index('bitacora_type_created_idx').on(table.type, table.createdAt),
  }),
);
