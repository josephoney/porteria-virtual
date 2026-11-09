import { pgTable, uuid, varchar, timestamp, pgEnum } from 'drizzle-orm/pg-core';
import { organizations } from './organizations';
import { users } from './users';
import { people } from './people';

export const visitorTypeEnum = pgEnum('visitor_type', ['permanent', 'temporary', 'delivery']);

export const visitors = pgTable('visitors', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  document: varchar('document', { length: 50 }),
  type: visitorTypeEnum('type').notNull().default('temporary'),
  photoUrl: varchar('photo_url', { length: 500 }),
  validFrom: timestamp('valid_from', { withTimezone: true }),
  validUntil: timestamp('valid_until', { withTimezone: true }),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdByPersonId: uuid('created_by_person_id').references(() => people.id, {
    onDelete: 'set null',
  }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
