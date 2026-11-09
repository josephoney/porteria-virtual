import {
  pgTable,
  uuid,
  varchar,
  integer,
  timestamp,
  pgEnum,
  jsonb,
  uniqueIndex,
  index,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { communities } from './communities';
import { locationStructures } from './location-structures';

export const sectionTypeEnum = pgEnum('section_type', [
  'tower',
  'interior',
  'building',
  'zone',
  'block',
  'sector',
  'floor',
  'house',
  'lot',
  'commercial',
  'other',
]);

export const locationUnitStatusEnum = pgEnum('location_unit_status', [
  'active',
  'inactive',
]);

export const locationUnits = pgTable(
  'location_units',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    communityId: uuid('community_id')
      .notNull()
      .references(() => communities.id, { onDelete: 'cascade' }),
    structureId: uuid('structure_id')
      .notNull()
      .references(() => locationStructures.id, { onDelete: 'cascade' }),
    parentId: uuid('parent_id').references((): AnyPgColumn => locationUnits.id, {
      onDelete: 'restrict',
    }),
    levelPosition: integer('level_position').notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    code: varchar('code', { length: 100 }),
    sectionType: sectionTypeEnum('section_type'),
    sectionTypeLabel: varchar('section_type_label', { length: 100 }),
    metadata: jsonb('metadata').notNull().default({}),
    status: locationUnitStatusEnum('status').notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    siblingCodeIdx: uniqueIndex('location_units_structure_parent_code_idx').on(
      table.structureId,
      table.parentId,
      table.code,
    ),
    communityIdx: index('location_units_community_idx').on(table.communityId),
    structureIdx: index('location_units_structure_idx').on(table.structureId),
    parentIdx: index('location_units_parent_idx').on(table.parentId),
  }),
);
