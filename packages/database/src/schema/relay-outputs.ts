import { pgTable, uuid, varchar, integer, timestamp, pgEnum, unique } from 'drizzle-orm/pg-core';
import { kiosks } from './kiosks';
import { accessPoints } from './access-points';

export const relayModeEnum = pgEnum('relay_mode', ['momentary', 'latch']);

export const relayOutputs = pgTable('relay_outputs', {
  id: uuid('id').defaultRandom().primaryKey(),
  kioskId: uuid('kiosk_id')
    .notNull()
    .references(() => kiosks.id, { onDelete: 'cascade' }),
  relayIndex: integer('relay_index').notNull(),
  gpioPin: integer('gpio_pin').notNull(),
  label: varchar('label', { length: 100 }).notNull(),
  mode: relayModeEnum('mode').notNull().default('momentary'),
  durationMs: integer('duration_ms'),
  accessPointId: uuid('access_point_id').references(() => accessPoints.id, {
    onDelete: 'set null',
  }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  unqKioskIndex: unique('relay_outputs_kiosk_index').on(table.kioskId, table.relayIndex),
  unqKioskPin: unique('relay_outputs_kiosk_pin').on(table.kioskId, table.gpioPin),
}));
