import {
  pgTable,
  uuid,
  varchar,
  integer,
  timestamp,
  pgEnum,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { communities } from './communities';
import { buildings } from './buildings';

export const unitTypeEnum = pgEnum('unit_type', [
  'apartment',
  'house',
  'office',
  'parking',
  'storage',
]);

export const unitStatusEnum = pgEnum('unit_status', ['active', 'inactive']);

export const units = pgTable(
  'units',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    communityId: uuid('community_id')
      .notNull()
      .references(() => communities.id, { onDelete: 'cascade' }),
    buildingId: uuid('building_id').references(() => buildings.id, {
      onDelete: 'set null',
    }),
    code: varchar('code', { length: 50 }).notNull(),
    floor: integer('floor'),
    type: unitTypeEnum('type').notNull().default('apartment'),
    status: unitStatusEnum('status').notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    communityCodeIdx: uniqueIndex('units_community_code_idx').on(
      table.communityId,
      table.code,
    ),
  }),
);
