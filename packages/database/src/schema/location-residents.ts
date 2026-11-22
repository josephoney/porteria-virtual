import { pgTable, uuid, date, timestamp, pgEnum, uniqueIndex } from 'drizzle-orm/pg-core';
import { people } from './people';
import { locationUnits } from './location-units';

export const locationResidentRelationshipEnum = pgEnum('location_resident_relationship', [
  'owner',
  'tenant',
  'resident',
  'family',
  'staff',
]);

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
    personId: uuid('person_id')
      .notNull()
      .references(() => people.id, { onDelete: 'cascade' }),
    relationship: locationResidentRelationshipEnum('relationship').notNull(),
    validFrom: date('valid_from').notNull(),
    validTo: date('valid_to'),
    status: locationResidentStatusEnum('status').notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    unitPersonRelationshipIdx: uniqueIndex('location_residents_unit_person_relationship_idx').on(
      table.locationUnitId,
      table.personId,
      table.relationship,
    ),
  }),
);
