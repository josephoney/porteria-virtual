import { pgTable, uuid, varchar, timestamp } from 'drizzle-orm/pg-core';
import { organizations } from './organizations';

export const locations = pgTable('locations', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  address: varchar('address', { length: 500 }).notNull(),
  timezone: varchar('timezone', { length: 50 }).notNull().default('UTC'),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
