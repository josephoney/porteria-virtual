import { pgTable, uuid, varchar, timestamp, pgEnum } from 'drizzle-orm/pg-core';
import { people } from './people';
import { communities } from './communities';

export const roundStatusEnum = pgEnum('round_status', [
  'scheduled',
  'in_progress',
  'completed',
  'missed',
]);

export const guardRounds = pgTable('guard_rounds', {
  id: uuid('id').defaultRandom().primaryKey(),
  guardPersonId: uuid('guard_person_id')
    .notNull()
    .references(() => people.id, { onDelete: 'cascade' }),
  communityId: uuid('community_id')
    .notNull()
    .references(() => communities.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  status: roundStatusEnum('status').notNull().default('scheduled'),
  scheduledAt: timestamp('scheduled_at', { withTimezone: true }),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
