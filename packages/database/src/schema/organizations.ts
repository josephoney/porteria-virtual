import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  text,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { people } from './people';

export const organizations = pgTable(
  'organizations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 255 }).notNull().unique(),
    slug: varchar('slug', { length: 60 }).notNull().unique(),
    nit: varchar('nit', { length: 30 }),
    phone: varchar('phone', { length: 30 }),
    address: varchar('address', { length: 500 }),
    legalRepresentativePersonId: uuid('legal_representative_person_id').references(
      () => people.id,
      { onDelete: 'set null' },
    ),
    logoAssetId: uuid('logo_asset_id'),
    welcomeMessage: text('welcome_message'),
    profileCompletedAt: timestamp('profile_completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    nitIdx: uniqueIndex('organizations_nit_idx').on(table.nit),
  }),
);
