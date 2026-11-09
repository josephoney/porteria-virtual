import {
  pgTable,
  uuid,
  date,
  timestamp,
  pgEnum,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { users } from './users';
import { locationUnits } from './location-units';

export const locationResidentRelationshipEnum = pgEnum(
  'location_resident_relationship',
  ['owner', 'tenant', 'resident', 'family', 'staff'],
);

export const locationResidentStatusEnum = pgEnum('location_resident_status', [
  'active',
  'inactive',
]);

export const locationResidents = pgTable(
  'location_residents',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    locationUnitId: uuid('location_unit_id')
      .notNull()
      .references(() => locationUnits.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    relationship: locationResidentRelationshipEnum('relationship').notNull(),
    validFrom: date('valid_from').notNull(),
    validTo: date('valid_to'),
    status: locationResidentStatusEnum('status').notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    unitUserRelationshipIdx: uniqueIndex(
      'location_residents_unit_user_relationship_idx',
    ).on(table.locationUnitId, table.userId, table.relationship),
  }),
);
