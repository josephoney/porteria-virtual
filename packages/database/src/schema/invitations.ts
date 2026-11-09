import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  pgEnum,
  index,
} from 'drizzle-orm/pg-core';
import type { MembershipRole } from '@porteria/shared';
import { organizations } from './organizations';
import { communities } from './communities';
import { units } from './units';
import { locationUnits } from './location-units';
import { users } from './users';

export const invitationStatusEnum = pgEnum('invitation_status', [
  'pending',
  'accepted',
  'revoked',
  'expired',
]);

export const invitations = pgTable(
  'invitations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tokenHash: varchar('token_hash', { length: 64 }).notNull().unique(),
    email: varchar('email', { length: 255 }).notNull(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    communityId: uuid('community_id').references(() => communities.id, {
      onDelete: 'cascade',
    }),
    unitId: uuid('unit_id').references(() => units.id, { onDelete: 'cascade' }),
    locationUnitId: uuid('location_unit_id').references(() => locationUnits.id, {
      onDelete: 'cascade',
    }),
    role: varchar('role', { length: 20 }).notNull().$type<MembershipRole>(),
    status: invitationStatusEnum('status').notNull().default('pending'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    invitedBy: uuid('invited_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    emailIdx: index('invitations_email_status_idx').on(table.email, table.status),
    communityIdx: index('invitations_community_status_idx').on(
      table.communityId,
      table.status,
    ),
  }),
);
