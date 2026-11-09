import { pgTable, uuid, varchar, integer, timestamp, pgEnum } from 'drizzle-orm/pg-core';
import { communities } from './communities';

export const locationStructureStatusEnum = pgEnum('location_structure_status', [
  'active',
  'inactive',
]);

export const locationStructures = pgTable('location_structures', {
  id: uuid('id').defaultRandom().primaryKey(),
  communityId: uuid('community_id')
    .notNull()
    .references(() => communities.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  levelCount: integer('level_count').notNull().default(3),
  level1Name: varchar('level_1_name', { length: 100 }).notNull().default('Sección'),
  level2Name: varchar('level_2_name', { length: 100 }),
  level3Name: varchar('level_3_name', { length: 100 }),
  status: locationStructureStatusEnum('status').notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
