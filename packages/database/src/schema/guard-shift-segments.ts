import {
  index,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { accessPoints } from './access-points';
import { guardShifts } from './guard-shifts';

export const guardShiftSegments = pgTable(
  'guard_shift_segments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    shiftId: uuid('shift_id')
      .notNull()
      .references(() => guardShifts.id, { onDelete: 'cascade' }),
    accessPointId: uuid('access_point_id')
      .notNull()
      .references(() => accessPoints.id, { onDelete: 'restrict' }),
    startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
    endedAt: timestamp('ended_at', { withTimezone: true }),
    endReason: varchar('end_reason', { length: 50 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    openSegmentIdx: uniqueIndex('guard_shift_segment_open_idx')
      .on(table.shiftId)
      .where(sql`ended_at IS NULL`),
    accessStartedIdx: index('guard_shift_segment_access_started_idx').on(
      table.accessPointId,
      table.startedAt,
    ),
    shiftStartedIdx: index('guard_shift_segment_shift_started_idx').on(
      table.shiftId,
      table.startedAt,
    ),
  }),
);
