import { pgTable, uuid, varchar, timestamp } from 'drizzle-orm/pg-core';
import { visitors } from './visitors';
import { accessPoints } from './access-points';
import { users } from './users';
import { people } from './people';

export const accessCodes = pgTable('access_codes', {
  id: uuid('id').defaultRandom().primaryKey(),
  code: varchar('code', { length: 50 }).notNull().unique(),
  visitorId: uuid('visitor_id').references(() => visitors.id, { onDelete: 'set null' }),
  accessPointId: uuid('access_point_id')
    .notNull()
    .references(() => accessPoints.id, { onDelete: 'cascade' }),
  validFrom: timestamp('valid_from', { withTimezone: true }).notNull(),
  validUntil: timestamp('valid_until', { withTimezone: true }).notNull(),
  usedAt: timestamp('used_at', { withTimezone: true }),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdByPersonId: uuid('created_by_person_id').references(() => people.id, {
    onDelete: 'set null',
  }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
