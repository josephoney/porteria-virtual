import {
  index,
  pgEnum,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { accounts } from './accounts';
import { communities } from './communities';
import { people } from './people';

export const guardShiftStatusEnum = pgEnum('guard_shift_status', ['open', 'closed']);

export const guardShifts = pgTable(
  'guard_shifts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    communityId: uuid('community_id')
      .notNull()
      .references(() => communities.id, { onDelete: 'cascade' }),
    guardPersonId: uuid('guard_person_id')
      .notNull()
      .references(() => people.id, { onDelete: 'restrict' }),
    guardAccountId: uuid('guard_account_id').references(() => accounts.id, {
      onDelete: 'set null',
    }),
    status: guardShiftStatusEnum('status').notNull().default('open'),
    startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
    endedAt: timestamp('ended_at', { withTimezone: true }),
    endedByPersonId: uuid('ended_by_person_id').references(() => people.id, {
      onDelete: 'set null',
    }),
    closedReason: varchar('closed_reason', { length: 50 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    openShiftIdx: uniqueIndex('guard_shift_open_idx')
      .on(table.guardPersonId)
      .where(sql`status = 'open'`),
    communityStatusIdx: index('guard_shift_community_status_idx').on(
      table.communityId,
      table.status,
    ),
    guardStartedIdx: index('guard_shift_guard_started_idx').on(
      table.guardPersonId,
      table.startedAt,
    ),
  }),
);
