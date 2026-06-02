import { pgTable, uuid, varchar, timestamp, pgEnum } from 'drizzle-orm/pg-core';
import { users } from './users';
import { locations } from './locations';

export const roundStatusEnum = pgEnum('round_status', ['scheduled', 'in_progress', 'completed', 'missed']);

export const guardRounds = pgTable('guard_rounds', {
  id: uuid('id').defaultRandom().primaryKey(),
  guardId: uuid('guard_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  locationId: uuid('location_id')
    .notNull()
    .references(() => locations.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  status: roundStatusEnum('status').notNull().default('scheduled'),
  scheduledAt: timestamp('scheduled_at', { withTimezone: true }),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
