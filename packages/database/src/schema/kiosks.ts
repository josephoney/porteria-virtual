import { pgTable, uuid, varchar, timestamp, pgEnum } from 'drizzle-orm/pg-core';
import { accessPoints } from './access-points';

export const kioskStatusEnum = pgEnum('kiosk_status', ['idle', 'calling', 'in-call', 'offline']);

export const kiosks = pgTable('kiosks', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  rpiId: varchar('rpi_id', { length: 100 }),
  ipAddress: varchar('ip_address', { length: 45 }),
  status: kioskStatusEnum('status').notNull().default('offline'),
  accessPointId: uuid('access_point_id')
    .unique()
    .references(() => accessPoints.id, { onDelete: 'set null' }),
  lastHeartbeat: timestamp('last_heartbeat', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
