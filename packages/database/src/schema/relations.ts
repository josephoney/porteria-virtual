import { relations } from 'drizzle-orm';
import { people } from './people';
import { accounts } from './accounts';
import { assets } from './assets';
import { organizations } from './organizations';
import { communities } from './communities';
import { buildings } from './buildings';
import { units } from './units';
import { locationStructures } from './location-structures';
import { locationUnits } from './location-units';
import { locationResidents } from './location-residents';
import { memberships } from './memberships';
import { accessPoints } from './access-points';
import { kiosks } from './kiosks';
import { users } from './users';
import { visitors } from './visitors';
import { refreshTokens } from './refresh-tokens';
import { calls } from './calls';
import { events } from './events';
import { guardRounds } from './guard-rounds';
import { guardCheckpoints } from './guard-checkpoints';
import { accessCodes } from './access-codes';
import { relayOutputs } from './relay-outputs';
import { invitations } from './invitations';

export const peopleRelations = relations(people, ({ one, many }) => ({
  account: one(accounts, {
    fields: [people.id],
    references: [accounts.personId],
  }),
  memberships: many(memberships),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  person: one(people, {
    fields: [accounts.personId],
    references: [people.id],
  }),
}));

export const assetsRelations = relations(assets, ({ one }) => ({
  organization: one(organizations, {
    fields: [assets.organizationId],
    references: [organizations.id],
  }),
  community: one(communities, {
    fields: [assets.communityId],
    references: [communities.id],
  }),
}));

export const organizationsRelations = relations(organizations, ({ many }) => ({
  communities: many(communities),
  memberships: many(memberships),
  visitors: many(visitors),
  invitations: many(invitations),
  calls: many(calls),
  events: many(events),
  assets: many(assets),
}));

export const communitiesRelations = relations(communities, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [communities.organizationId],
    references: [organizations.id],
  }),
  buildings: many(buildings),
  units: many(units),
  memberships: many(memberships),
  accessPoints: many(accessPoints),
  kiosks: many(kiosks),
  calls: many(calls),
  events: many(events),
  invitations: many(invitations),
  guardRounds: many(guardRounds),
  assets: many(assets),
}));

export const buildingsRelations = relations(buildings, ({ one, many }) => ({
  community: one(communities, {
    fields: [buildings.communityId],
    references: [communities.id],
  }),
  units: many(units),
}));

export const locationStructuresRelations = relations(locationStructures, ({ one, many }) => ({
  community: one(communities, {
    fields: [locationStructures.communityId],
    references: [communities.id],
  }),
  units: many(locationUnits),
}));

export const locationUnitsRelations = relations(locationUnits, ({ one, many }) => ({
  community: one(communities, {
    fields: [locationUnits.communityId],
    references: [communities.id],
  }),
  structure: one(locationStructures, {
    fields: [locationUnits.structureId],
    references: [locationStructures.id],
  }),
  parent: one(locationUnits, {
    fields: [locationUnits.parentId],
    references: [locationUnits.id],
    relationName: 'locationUnitChildren',
  }),
  children: many(locationUnits, { relationName: 'locationUnitChildren' }),
  residents: many(locationResidents),
}));

export const locationResidentsRelations = relations(locationResidents, ({ one }) => ({
  locationUnit: one(locationUnits, {
    fields: [locationResidents.locationUnitId],
    references: [locationUnits.id],
  }),
  user: one(users, {
    fields: [locationResidents.userId],
    references: [users.id],
  }),
}));

export const unitsRelations = relations(units, ({ one, many }) => ({
  community: one(communities, {
    fields: [units.communityId],
    references: [communities.id],
  }),
  building: one(buildings, {
    fields: [units.buildingId],
    references: [buildings.id],
  }),
  memberships: many(memberships),
  invitations: many(invitations),
}));

export const membershipsRelations = relations(memberships, ({ one }) => ({
  user: one(users, {
    fields: [memberships.userId],
    references: [users.id],
  }),
  organization: one(organizations, {
    fields: [memberships.organizationId],
    references: [organizations.id],
  }),
  community: one(communities, {
    fields: [memberships.communityId],
    references: [communities.id],
  }),
  unit: one(units, {
    fields: [memberships.unitId],
    references: [units.id],
  }),
  person: one(people, {
    fields: [memberships.personId],
    references: [people.id],
  }),
  locationUnit: one(locationUnits, {
    fields: [memberships.locationUnitId],
    references: [locationUnits.id],
  }),
}));

export const accessPointsRelations = relations(accessPoints, ({ one, many }) => ({
  community: one(communities, {
    fields: [accessPoints.communityId],
    references: [communities.id],
  }),
  kiosk: one(kiosks, {
    fields: [accessPoints.id],
    references: [kiosks.accessPointId],
  }),
  calls: many(calls),
  events: many(events),
  accessCodes: many(accessCodes),
  relayOutputs: many(relayOutputs),
}));

export const kiosksRelations = relations(kiosks, ({ one, many }) => ({
  community: one(communities, {
    fields: [kiosks.communityId],
    references: [communities.id],
  }),
  accessPoint: one(accessPoints, {
    fields: [kiosks.accessPointId],
    references: [accessPoints.id],
  }),
  calls: many(calls),
  relayOutputs: many(relayOutputs),
}));

export const usersRelations = relations(users, ({ many }) => ({
  memberships: many(memberships),
  refreshTokens: many(refreshTokens),
  calls: many(calls, { relationName: 'operatorCalls' }),
  createdVisitors: many(visitors, { relationName: 'createdVisitors' }),
  guardRounds: many(guardRounds),
  createdAccessCodes: many(accessCodes, { relationName: 'createdCodes' }),
  sentInvitations: many(invitations, { relationName: 'sentInvitations' }),
}));

export const visitorsRelations = relations(visitors, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [visitors.organizationId],
    references: [organizations.id],
  }),
  createdBy: one(users, {
    fields: [visitors.createdBy],
    references: [users.id],
    relationName: 'createdVisitors',
  }),
  accessCodes: many(accessCodes),
}));

export const refreshTokensRelations = relations(refreshTokens, ({ one }) => ({
  user: one(users, {
    fields: [refreshTokens.userId],
    references: [users.id],
  }),
}));

export const callsRelations = relations(calls, ({ one }) => ({
  kiosk: one(kiosks, {
    fields: [calls.kioskId],
    references: [kiosks.id],
  }),
  operator: one(users, {
    fields: [calls.operatorId],
    references: [users.id],
    relationName: 'operatorCalls',
  }),
  organization: one(organizations, {
    fields: [calls.organizationId],
    references: [organizations.id],
  }),
  community: one(communities, {
    fields: [calls.communityId],
    references: [communities.id],
  }),
  accessPoint: one(accessPoints, {
    fields: [calls.accessPointId],
    references: [accessPoints.id],
  }),
}));

export const eventsRelations = relations(events, ({ one }) => ({
  organization: one(organizations, {
    fields: [events.organizationId],
    references: [organizations.id],
  }),
  community: one(communities, {
    fields: [events.communityId],
    references: [communities.id],
  }),
  accessPoint: one(accessPoints, {
    fields: [events.accessPointId],
    references: [accessPoints.id],
  }),
}));

export const guardRoundsRelations = relations(guardRounds, ({ one, many }) => ({
  guard: one(users, {
    fields: [guardRounds.guardId],
    references: [users.id],
  }),
  community: one(communities, {
    fields: [guardRounds.communityId],
    references: [communities.id],
  }),
  checkpoints: many(guardCheckpoints),
}));

export const guardCheckpointsRelations = relations(guardCheckpoints, ({ one }) => ({
  round: one(guardRounds, {
    fields: [guardCheckpoints.roundId],
    references: [guardRounds.id],
  }),
}));

export const accessCodesRelations = relations(accessCodes, ({ one }) => ({
  visitor: one(visitors, {
    fields: [accessCodes.visitorId],
    references: [visitors.id],
  }),
  accessPoint: one(accessPoints, {
    fields: [accessCodes.accessPointId],
    references: [accessPoints.id],
  }),
  createdBy: one(users, {
    fields: [accessCodes.createdBy],
    references: [users.id],
    relationName: 'createdCodes',
  }),
}));

export const relayOutputsRelations = relations(relayOutputs, ({ one }) => ({
  kiosk: one(kiosks, {
    fields: [relayOutputs.kioskId],
    references: [kiosks.id],
  }),
  accessPoint: one(accessPoints, {
    fields: [relayOutputs.accessPointId],
    references: [accessPoints.id],
  }),
}));
export const invitationsRelations = relations(invitations, ({ one }) => ({
  organization: one(organizations, {
    fields: [invitations.organizationId],
    references: [organizations.id],
  }),
  community: one(communities, {
    fields: [invitations.communityId],
    references: [communities.id],
  }),
  unit: one(units, {
    fields: [invitations.unitId],
    references: [units.id],
  }),
  locationUnit: one(locationUnits, {
    fields: [invitations.locationUnitId],
    references: [locationUnits.id],
  }),
  invitedBy: one(users, {
    fields: [invitations.invitedBy],
    references: [users.id],
    relationName: 'sentInvitations',
  }),
}));