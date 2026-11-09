import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  pgEnum,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';

export const personStatusEnum = pgEnum('person_status', ['active', 'inactive']);

export const people = pgTable(
  'people',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    firstName: varchar('first_name', { length: 120 }).notNull(),
    lastName: varchar('last_name', { length: 120 }).notNull().default(''),
    documentType: varchar('document_type', { length: 30 }),
    documentNumber: varchar('document_number', { length: 50 }),
    phone: varchar('phone', { length: 30 }),
    contactEmail: varchar('contact_email', { length: 255 }),
    status: personStatusEnum('status').notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    documentIdx: uniqueIndex('people_document_type_number_idx').on(
      table.documentType,
      table.documentNumber,
    ),
    contactEmailIdx: index('people_contact_email_idx').on(table.contactEmail),
  }),
);
