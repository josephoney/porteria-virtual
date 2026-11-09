import {
  pgTable,
  uuid,
  text,
  jsonb,
  timestamp,
  integer,
  pgEnum,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { organizations } from './organizations';
import { communities } from './communities';

export const outboxStatusEnum = pgEnum('outbox_status', [
  'pending',
  'processing',
  'done',
  'dead',
]);

export const outboxEvents = pgTable(
  'outbox_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    eventId: uuid('event_id').notNull(),
    eventType: text('event_type').notNull(),
    aggregateType: text('aggregate_type'),
    aggregateId: uuid('aggregate_id'),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    communityId: uuid('community_id').references(() => communities.id, {
      onDelete: 'set null',
    }),
    payload: jsonb('payload')
      .default(sql`'{}'::jsonb`)
      .notNull(),
    envelope: jsonb('envelope').notNull(),
    status: outboxStatusEnum('status').notNull().default('pending'),
    attempts: integer('attempts').notNull().default(0),
    availableAt: timestamp('available_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    processedAt: timestamp('processed_at', { withTimezone: true }),
    lastError: text('last_error'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    eventIdIdx: uniqueIndex('outbox_event_id_idx').on(table.eventId),
    statusAvailableIdx: index('outbox_status_available_idx').on(
      table.status,
      table.availableAt,
    ),
  }),
);

export const ingestedEvents = pgTable('ingested_events', {
  eventId: uuid('event_id').primaryKey(),
  ingestedAt: timestamp('ingested_at', { withTimezone: true }).defaultNow().notNull(),
});
