import { boolean, index, integer, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';

import { organizations } from './organizations';

/**
 * Resumen de cada barrido de retención.
 *
 * Se persiste también la simulación: saber cuántas filas se habrían anonimizado
 * es lo que permite decidir con datos antes de habilitar la escritura.
 */
export const retentionRuns = pgTable(
  'retention_runs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    ranAt: timestamp('ran_at', { withTimezone: true }).defaultNow().notNull(),
    /** Ventana aplicada, en días, al momento de la corrida. */
    retentionDays: integer('retention_days').notNull(),
    dryRun: boolean('dry_run').notNull(),
    anonymizedPasses: integer('anonymized_passes').notNull().default(0),
    anonymizedScans: integer('anonymized_scans').notNull().default(0),
    anonymizedEntries: integer('anonymized_entries').notNull().default(0),
  },
  (table) => ({
    organizationRanAtIdx: index('retention_runs_organization_ran_at_idx').on(
      table.organizationId,
      table.ranAt,
    ),
  }),
);

export type RetentionRun = typeof retentionRuns.$inferSelect;
