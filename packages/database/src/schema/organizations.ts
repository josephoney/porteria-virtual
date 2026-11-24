import { integer, pgTable, uuid, varchar, timestamp, text, uniqueIndex } from 'drizzle-orm/pg-core';
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
    municipality: varchar('municipality', { length: 120 }),
    department: varchar('department', { length: 120 }),
    country: varchar('country', { length: 120 }),
    legalRepresentativePersonId: uuid('legal_representative_person_id').references(
      () => people.id,
      { onDelete: 'set null' },
    ),
    logoAssetId: uuid('logo_asset_id'),
    welcomeMessage: text('welcome_message'),
    /**
     * Días que se conserva la identidad del visitante en el registro de acceso.
     * La organización es la responsable del dato: la plataforma sólo ejecuta la
     * ventana que ella define. El servicio limita los valores a 30, 60 o 90.
     */
    retentionDays: integer('retention_days').notNull().default(30),
    profileCompletedAt: timestamp('profile_completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    nitIdx: uniqueIndex('organizations_nit_idx').on(table.nit),
  }),
);
