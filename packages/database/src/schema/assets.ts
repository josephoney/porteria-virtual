import {
  pgTable,
  uuid,
  varchar,
  integer,
  timestamp,
  pgEnum,
  index,
} from 'drizzle-orm/pg-core';
import { organizations } from './organizations';
import { communities } from './communities';
import { people } from './people';

export const assetKindEnum = pgEnum('asset_kind', [
  'organization_logo',
  'community_logo',
]);

export const assets = pgTable(
  'assets',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    communityId: uuid('community_id').references(() => communities.id, {
      onDelete: 'cascade',
    }),
    kind: assetKindEnum('kind').notNull(),
    storageKey: varchar('storage_key', { length: 500 }).notNull(),
    mimeType: varchar('mime_type', { length: 100 }).notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    checksum: varchar('checksum', { length: 128 }),
    createdByPersonId: uuid('created_by_person_id').references(() => people.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    organizationIdx: index('assets_organization_idx').on(
      table.organizationId,
      table.kind,
    ),
    communityIdx: index('assets_community_idx').on(table.communityId, table.kind),
  }),
);
