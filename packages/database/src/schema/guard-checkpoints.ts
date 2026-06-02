import { pgTable, uuid, varchar, integer, timestamp } from 'drizzle-orm/pg-core';
import { guardRounds } from './guard-rounds';

export const guardCheckpoints = pgTable('guard_checkpoints', {
  id: uuid('id').defaultRandom().primaryKey(),
  roundId: uuid('round_id')
    .notNull()
    .references(() => guardRounds.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  orderIndex: integer('order_index').notNull(),
  scannedAt: timestamp('scanned_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
