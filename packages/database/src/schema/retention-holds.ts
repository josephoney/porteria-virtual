import { date, index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { communities } from './communities';
import { organizations } from './organizations';
import { people } from './people';

/**
 * Rango de fechas que la organización congela para una investigación.
 *
 * El barrido de retención no toca los accesos cuya fecha cae dentro de un rango
 * activo. La preservación vence sola (`expires_at`) y puede liberarse antes; en
 * ambos casos queda registrado quién la creó, por qué y cuándo terminó, porque
 * alargar la conservación de datos personales también hay que poder explicarlo.
 */
export const retentionHolds = pgTable(
  'retention_holds',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    /** Vacío: el rango cubre todas las comunidades de la organización. */
    communityId: uuid('community_id').references(() => communities.id, { onDelete: 'set null' }),
    fromDate: date('from_date').notNull(),
    toDate: date('to_date').notNull(),
    reason: text('reason').notNull(),
    createdByPersonId: uuid('created_by_person_id').references(() => people.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    releasedAt: timestamp('released_at', { withTimezone: true }),
    releasedByPersonId: uuid('released_by_person_id').references(() => people.id, {
      onDelete: 'set null',
    }),
  },
  (table) => ({
    organizationRangeIdx: index('retention_holds_organization_range_idx').on(
      table.organizationId,
      table.fromDate,
      table.toDate,
    ),
  }),
);

export type RetentionHold = typeof retentionHolds.$inferSelect;
