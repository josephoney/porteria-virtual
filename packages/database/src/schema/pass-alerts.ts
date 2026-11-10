import { sql } from 'drizzle-orm';
import { pgEnum, pgTable, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { accessPasses } from './access-passes';
import { communities } from './communities';
import { people } from './people';

export const passAlertTypeEnum = pgEnum('pass_alert_type', ['missing_exit']);

export const passAlertStatusEnum = pgEnum('pass_alert_status', ['open', 'resolved']);

export const passAlerts = pgTable(
  'pass_alerts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    passId: uuid('pass_id')
      .notNull()
      .references(() => accessPasses.id, { onDelete: 'cascade' }),
    communityId: uuid('community_id')
      .notNull()
      .references(() => communities.id, { onDelete: 'cascade' }),
    type: passAlertTypeEnum('type').notNull(),
    status: passAlertStatusEnum('status').notNull().default('open'),
    dueAt: timestamp('due_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    resolvedByPersonId: uuid('resolved_by_person_id').references(() => people.id, {
      onDelete: 'set null',
    }),
  },
  (table) => ({
    openAlertIdx: uniqueIndex('pass_alert_open_idx')
      .on(table.passId, table.type)
      .where(sql`${table.status} = 'open'`),
  }),
);
