import { pgTable, uuid, text, jsonb, timestamp, primaryKey } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { organizations } from './organizations';
import { communities } from './communities';
import { accessPoints } from './access-points';
import { people } from './people';

export const events = pgTable(
  'events',
  {
    id: uuid('id').defaultRandom().notNull(),
    eventType: text('event_type').notNull(),
    actorId: uuid('actor_id'),
    actorPersonId: uuid('actor_person_id').references(() => people.id, {
      onDelete: 'set null',
    }),
    actorRole: text('actor_role'),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    communityId: uuid('community_id').references(() => communities.id, {
      onDelete: 'set null',
    }),
    accessPointId: uuid('access_point_id').references(() => accessPoints.id, {
      onDelete: 'set null',
    }),
    metadata: jsonb('metadata').default(sql`'{}'::jsonb`).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.createdAt, table.id] }),
  }),
);

// Hypertable configuration — applied via raw SQL after table creation
export const EVENTS_HYPERTABLE_SQL = sql`
  SELECT create_hypertable('events', 'created_at', chunk_time_interval => INTERVAL '7 days', if_not_exists => TRUE);
  CREATE INDEX IF NOT EXISTS events_org_time_idx ON events (organization_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS events_org_type_time_idx ON events (organization_id, event_type, created_at DESC);
`;
