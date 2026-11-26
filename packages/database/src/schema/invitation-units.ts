import { pgTable, uuid, timestamp, primaryKey, index } from 'drizzle-orm/pg-core';
import { invitations } from './invitations';
import { locationUnits } from './location-units';

/**
 * Unidades cubiertas por una invitación.
 *
 * `invitations.location_unit_id` sigue siendo la unidad principal (compatibilidad
 * con el flujo de aceptación y el contexto activo); esta tabla agrega las demás
 * unidades de la misma comunidad.
 */
export const invitationUnits = pgTable(
  'invitation_units',
  {
    invitationId: uuid('invitation_id')
      .notNull()
      .references(() => invitations.id, { onDelete: 'cascade' }),
    locationUnitId: uuid('location_unit_id')
      .notNull()
      .references(() => locationUnits.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.invitationId, table.locationUnitId] }),
    locationUnitIdx: index('invitation_units_location_unit_idx').on(table.locationUnitId),
  }),
);
