import { pgTable, uuid, varchar, integer, timestamp, pgEnum } from 'drizzle-orm/pg-core';
import { communities } from './communities';

export const accessPointTypeEnum = pgEnum('access_point_type', ['door', 'gate', 'turnstile']);

export const accessFailPolicyEnum = pgEnum('access_fail_policy', ['open', 'closed']);

export const accessDirectionEnum = pgEnum('access_direction', ['entry', 'exit', 'both']);

export const accessPoints = pgTable('access_points', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  type: accessPointTypeEnum('type').notNull().default('door'),
  gpioPin: integer('gpio_pin').notNull(),
  communityId: uuid('community_id')
    .notNull()
    .references(() => communities.id, { onDelete: 'cascade' }),
  failPolicy: accessFailPolicyEnum('fail_policy').notNull().default('closed'),
  direction: accessDirectionEnum('direction').notNull().default('both'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
