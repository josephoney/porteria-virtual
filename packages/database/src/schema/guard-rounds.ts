import { pgTable, uuid, varchar, timestamp, pgEnum } from 'drizzle-orm/pg-core';
import { users } from './users';
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
  guardId: uuid('guard_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  guardPersonId: uuid('guard_person_id').references(() => people.id, {
    onDelete: 'set null',
  }),
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
