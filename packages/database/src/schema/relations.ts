import { relations } from 'drizzle-orm';
import { organizations } from './organizations';
import { locations } from './locations';
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

export const organizationsRelations = relations(organizations, ({ many }) => ({
  locations: many(locations),
  users: many(users),
  visitors: many(visitors),
  calls: many(calls),
  events: many(events),
}));

export const locationsRelations = relations(locations, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [locations.organizationId],
    references: [organizations.id],
  }),
  accessPoints: many(accessPoints),
  users: many(users),
  events: many(events),
  guardRounds: many(guardRounds),
}));

export const accessPointsRelations = relations(accessPoints, ({ one, many }) => ({
  location: one(locations, {
    fields: [accessPoints.locationId],
    references: [locations.id],
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
  accessPoint: one(accessPoints, {
    fields: [kiosks.accessPointId],
    references: [accessPoints.id],
  }),
  calls: many(calls),
  relayOutputs: many(relayOutputs),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [users.organizationId],
    references: [organizations.id],
  }),
  location: one(locations, {
    fields: [users.locationId],
    references: [locations.id],
  }),
  refreshTokens: many(refreshTokens),
  calls: many(calls, { relationName: 'operatorCalls' }),
  createdVisitors: many(visitors, { relationName: 'createdVisitors' }),
  guardRounds: many(guardRounds),
  createdAccessCodes: many(accessCodes, { relationName: 'createdCodes' }),
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
  location: one(locations, {
    fields: [events.locationId],
    references: [locations.id],
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
  location: one(locations, {
    fields: [guardRounds.locationId],
    references: [locations.id],
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
