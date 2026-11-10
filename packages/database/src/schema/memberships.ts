import {
  pgTable,
  uuid,
  timestamp,
  pgEnum,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { users } from './users';
import { organizations } from './organizations';
import { communities } from './communities';
import { units } from './units';
import { people } from './people';
import { locationUnits } from './location-units';
import { accessPoints } from './access-points';

export const membershipRoleEnum = pgEnum('membership_role', [
  'org_admin',
  'community_admin',
  'operator',
  'guard',
  'owner',
  'tenant',
  'resident',
  'staff',
]);

export const membershipStatusEnum = pgEnum('membership_status', ['active', 'inactive']);

export const memberships = pgTable(
  'memberships',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    personId: uuid('person_id').references(() => people.id, {
      onDelete: 'cascade',
    }),
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
    defaultAccessPointId: uuid('default_access_point_id').references(
      () => accessPoints.id,
      { onDelete: 'set null' },
    ),
    role: membershipRoleEnum('role').notNull(),
    status: membershipStatusEnum('status').notNull().default('active'),
    validFrom: timestamp('valid_from', { withTimezone: true }),
    validTo: timestamp('valid_to', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    uniqueMembership: uniqueIndex('memberships_unique_idx').on(
      table.userId,
      table.organizationId,
      table.communityId,
      table.unitId,
      table.role,
    ),
    userIdx: index('memberships_user_idx').on(table.userId, table.status),
    personIdx: index('memberships_person_idx').on(table.personId, table.status),
    locationUnitIdx: index('memberships_location_unit_idx').on(
      table.locationUnitId,
      table.status,
    ),
    orgIdx: index('memberships_org_idx').on(table.organizationId, table.status),
    communityIdx: index('memberships_community_idx').on(
      table.communityId,
      table.status,
    ),
    defaultAccessPointIdx: index('memberships_default_access_point_idx').on(
      table.defaultAccessPointId,
    ),
  }),
);
