import { pgTable, uuid, varchar, boolean, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { UserRole } from '@porteria/shared';
import { organizations } from './organizations';
import { locations } from './locations';

export const users = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    email: varchar('email', { length: 255 }).notNull(),
    passwordHash: varchar('password_hash', { length: 255 }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    role: varchar('role', { length: 20 }).notNull().$type<UserRole>(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    locationId: uuid('location_id').references(() => locations.id, { onDelete: 'set null' }),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    emailOrgIdx: uniqueIndex('users_email_org_idx').on(table.email, table.organizationId),
  }),
);
