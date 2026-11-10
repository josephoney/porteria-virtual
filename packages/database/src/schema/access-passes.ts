import { sql } from 'drizzle-orm';
import {
  boolean,
  char,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  time,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { communities } from './communities';
import { locationStructures } from './location-structures';
import { locationUnits } from './location-units';
import { people } from './people';

export const passTypeEnum = pgEnum('pass_type', [
  'entry_only',
  'entry_exit',
  'entry_exit_recurring',
]);

export const passStatusEnum = pgEnum('pass_status', ['active', 'used', 'revoked', 'expired']);

export const presenceStateEnum = pgEnum('presence_state', ['outside', 'inside']);

export const accessPasses = pgTable(
  'access_passes',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    communityId: uuid('community_id')
      .notNull()
      .references(() => communities.id, { onDelete: 'cascade' }),
    locationUnitId: uuid('location_unit_id')
      .notNull()
      .references(() => locationUnits.id, { onDelete: 'restrict' }),
    structureId: uuid('structure_id')
      .notNull()
      .references(() => locationStructures.id, { onDelete: 'restrict' }),
    createdByPersonId: uuid('created_by_person_id')
      .notNull()
      .references(() => people.id, { onDelete: 'restrict' }),
    authorizedByPersonId: uuid('authorized_by_person_id')
      .notNull()
      .references(() => people.id, { onDelete: 'restrict' }),
    authorizedByDelegationId: uuid('authorized_by_delegation_id'),
    visitorFirstName: varchar('visitor_first_name', { length: 120 }).notNull(),
    visitorLastName: varchar('visitor_last_name', { length: 120 }).notNull(),
    visitorDocument: varchar('visitor_document', { length: 50 }).notNull(),
    hasVehicle: boolean('has_vehicle').notNull().default(false),
    vehiclePlate: varchar('vehicle_plate', { length: 20 }),
    type: passTypeEnum('type').notNull(),
    validFrom: timestamp('valid_from', { withTimezone: true }).notNull(),
    validUntil: timestamp('valid_until', { withTimezone: true }).notNull(),
    allowedDays: jsonb('allowed_days').$type<number[] | null>(),
    timeFrom: time('time_from'),
    timeTo: time('time_to'),
    status: passStatusEnum('status').notNull().default('active'),
    presenceState: presenceStateEnum('presence_state').notNull().default('outside'),
    linkTokenHash: char('link_token_hash', { length: 64 }).notNull(),
    deviceKeyHash: char('device_key_hash', { length: 64 }),
    linkExpiresAt: timestamp('link_expires_at', { withTimezone: true }).notNull(),
    pinHash: text('pin_hash'),
    pinEnabled: boolean('pin_enabled').notNull().default(false),
    pinFailedAttempts: integer('pin_failed_attempts').notNull().default(0),
    pinLockedUntil: timestamp('pin_locked_until', { withTimezone: true }),
    boundAt: timestamp('bound_at', { withTimezone: true }),
    entryAt: timestamp('entry_at', { withTimezone: true }),
    exitAt: timestamp('exit_at', { withTimezone: true }),
    entryCount: integer('entry_count').notNull().default(0),
    exitCount: integer('exit_count').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    linkTokenHashIdx: uniqueIndex('access_pass_link_token_hash_idx').on(table.linkTokenHash),
    communityStatusIdx: index('access_pass_community_status_idx').on(
      table.communityId,
      table.status,
    ),
    locationUnitCreatedIdx: index('access_pass_location_unit_created_idx').on(
      table.locationUnitId,
      table.createdAt,
    ),
    activeValidUntilIdx: index('access_pass_active_valid_until_idx')
      .on(table.validUntil)
      .where(sql`${table.status} = 'active'`),
  }),
);
