import { pgTable, uuid, text, integer, timestamp, pgEnum } from 'drizzle-orm/pg-core';
import { kiosks } from './kiosks';
import { users } from './users';
import { people } from './people';
import { organizations } from './organizations';
import { accessPoints } from './access-points';
import { communities } from './communities';

export const callStatusEnum = pgEnum('call_status', ['pending', 'active', 'ended', 'missed']);

export const calls = pgTable('calls', {
  id: text('id').primaryKey(),
  kioskId: uuid('kiosk_id')
    .notNull()
    .references(() => kiosks.id, { onDelete: 'cascade' }),
  operatorId: uuid('operator_id').references(() => users.id, { onDelete: 'set null' }),
  operatorPersonId: uuid('operator_person_id').references(() => people.id, {
    onDelete: 'set null',
  }),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  communityId: uuid('community_id')
    .notNull()
    .references(() => communities.id, { onDelete: 'cascade' }),
  accessPointId: uuid('access_point_id').references(() => accessPoints.id, {
    onDelete: 'set null',
  }),
  status: callStatusEnum('status').notNull().default('pending'),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  endedAt: timestamp('ended_at', { withTimezone: true }),
  duration: integer('duration'),
});
