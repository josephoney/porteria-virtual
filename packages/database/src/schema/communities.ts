import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  text,
  numeric,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { organizations } from './organizations';

export const communityStatusEnum = pgEnum('community_status', ['active', 'inactive']);

export const communityTypeEnum = pgEnum('community_type', [
  'conjunto',
  'condominio',
  'club',
  'hotel',
  'edificio',
  'otro',
]);

export const communities = pgTable('communities', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 60 }).notNull().unique(),
  address: varchar('address', { length: 500 }).notNull(),
  phone: varchar('phone', { length: 30 }),
  type: communityTypeEnum('type').notNull().default('conjunto'),
  typeLabel: varchar('type_label', { length: 100 }),
  latitude: numeric('latitude', { precision: 9, scale: 6 }),
  longitude: numeric('longitude', { precision: 9, scale: 6 }),
  timezone: varchar('timezone', { length: 50 }).notNull().default('UTC'),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  logoAssetId: uuid('logo_asset_id'),
  welcomeMessage: text('welcome_message'),
  status: communityStatusEnum('status').notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
