import { pgTable, uuid, varchar, integer, timestamp, pgEnum } from 'drizzle-orm/pg-core';
import { locations } from './locations';

export const accessPointTypeEnum = pgEnum('access_point_type', ['door', 'gate', 'turnstile']);

export const accessPoints = pgTable('access_points', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  type: accessPointTypeEnum('type').notNull().default('door'),
  gpioPin: integer('gpio_pin').notNull(),
  locationId: uuid('location_id')
    .notNull()
    .references(() => locations.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
