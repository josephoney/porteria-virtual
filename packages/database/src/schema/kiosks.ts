import { pgTable, uuid, varchar, timestamp, pgEnum, uniqueIndex } from 'drizzle-orm/pg-core';
import { accessPoints } from './access-points';
import { communities } from './communities';

export const kioskStatusEnum = pgEnum('kiosk_status', ['idle', 'calling', 'in-call', 'offline']);

export const kiosks = pgTable('kiosks', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  rpiId: varchar('rpi_id', { length: 100 }),
  ipAddress: varchar('ip_address', { length: 45 }),
  status: kioskStatusEnum('status').notNull().default('offline'),
  communityId: uuid('community_id')
    .notNull()
    .references(() => communities.id, { onDelete: 'cascade' }),
  accessPointId: uuid('access_point_id')
    .unique()
    .references(() => accessPoints.id, { onDelete: 'set null' }),
  deviceTokenHash: varchar('device_token_hash', { length: 255 }),
  deviceTokenRotatedAt: timestamp('device_token_rotated_at', { withTimezone: true }),
  lastHeartbeat: timestamp('last_heartbeat', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  rpiIdUnique: uniqueIndex('kiosks_rpi_id_unique').on(table.rpiId),
}));
