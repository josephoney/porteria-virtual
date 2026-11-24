import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { eq, inArray } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';

process.env.OUTBOX_WORKER_ENABLED = 'false';
process.env.NODE_ENV = 'test';

import { createDb } from '@porteria/database';
import {
  accessPasses,
  accessPoints,
  accounts,
  communities,
  events,
  locationStructures,
  locationUnits,
  memberships,
  organizations,
  passScans,
  people,
} from '@porteria/database/schema';
import { listEvents } from '../src/services/events.service.js';

const db = createDb();

const runId = randomUUID().slice(0, 8);

let app: FastifyInstance;

let organizationAId: string;
let organizationBId: string;
let communityAId: string;
let communityBId: string;
let accessPointAId: string;
let structureAId: string;
let unitAId: string;
let passId: string;
let scanId: string;

let platformToken: string;
let orgAdminToken: string;
let communityAdminToken: string;

const personIds: string[] = [];
const accountIds: string[] = [];
const membershipIds: string[] = [];

type Json = Record<string, unknown>;

interface EventsResponse {
  data: Array<{
    id: string;
    eventType: string;
    actorName: string | null;
    organizationId: string;
    organizationName: string | null;
    communityId: string | null;
    communityName: string | null;
    accessPointId: string | null;
    accessPointName: string | null;
    trace: {
      passCode: string;
      visitorName: string | null;
      passCreatedAt: string | null;
      passCreatedBy: string | null;
      authorizedBy: string | null;
      scanId: string | null;
      scanStatus: string | null;
      scannedAt: string | null;
      confirmedAt: string | null;
      reason: string | null;
    } | null;
  }>;
  total: number;
}

function auth(token: string) {
  return { authorization: `Bearer ${token}` };
}

async function request(url: string, token: string) {
  return app.inject({ method: 'GET', url, headers: auth(token) });
}

function parse(response: { body: string }): Json {
  return JSON.parse(response.body) as Json;
}

function tokenFor(claims: {
  accountId: string;
  personId: string;
  orgId: string;
  communityId: string | null;
  role: string;
  isPlatformAdmin?: boolean;
  membershipId?: string;
}) {
  return app.jwt.sign({
    sub: claims.accountId,
    email: `${claims.role}-${randomUUID().slice(0, 6)}@test.local`,
    accountId: claims.accountId,
    personId: claims.personId,
    orgId: claims.orgId,
    membershipId: claims.membershipId ?? 'test-membership',
    role: claims.role,
    communityId: claims.communityId,
    unitId: null,
    isPlatformAdmin: claims.isPlatformAdmin ?? false,
  });
}

async function createPerson(firstName: string, lastName: string) {
  const [person] = await db.insert(people).values({ firstName, lastName }).returning();
  personIds.push(person.id);
  return person;
}

async function createAccount(personId: string, email: string) {
  const [account] = await db
    .insert(accounts)
    .values({ personId, email, passwordHash: 'x' })
    .returning();
  accountIds.push(account.id);
  return account;
}

async function createMembership(
  personId: string,
  organizationId: string,
  communityId: string | null,
  role: 'org_admin' | 'community_admin',
) {
  const [membership] = await db
    .insert(memberships)
    .values({ personId, organizationId, communityId, role, status: 'active' })
    .returning();
  membershipIds.push(membership.id);
  return membership;
}

describe('events integration', () => {
  before(async () => {
    const { buildApp } = await import('../src/index.js');
    app = (await buildApp()).app;

    const [organizationA, organizationB] = await db
      .insert(organizations)
      .values([
        { name: `qa-events-a-${runId}`, slug: `qa-events-a-${runId}` },
        { name: `qa-events-b-${runId}`, slug: `qa-events-b-${runId}` },
      ])
      .returning();
    organizationAId = organizationA.id;
    organizationBId = organizationB.id;

    const [communityA, communityB] = await db
      .insert(communities)
      .values([
        {
          organizationId: organizationAId,
          name: `Comunidad A ${runId}`,
          slug: `qa-events-community-a-${runId}`,
          address: 'Calle A 1',
          timezone: 'UTC',
        },
        {
          organizationId: organizationBId,
          name: `Comunidad B ${runId}`,
          slug: `qa-events-community-b-${runId}`,
          address: 'Calle B 1',
          timezone: 'UTC',
        },
      ])
      .returning();
    communityAId = communityA.id;
    communityBId = communityB.id;

    const [accessPointA] = await db
      .insert(accessPoints)
      .values({ communityId: communityAId, name: `Portón A ${runId}`, type: 'gate' })
      .returning();
    accessPointAId = accessPointA.id;

    const [structureA] = await db
      .insert(locationStructures)
      .values({
        communityId: communityAId,
        name: 'Estructura A',
        levelCount: 1,
        level1Name: 'Casa',
      })
      .returning();
    structureAId = structureA.id;

    const [unitA] = await db
      .insert(locationUnits)
      .values({
        communityId: communityAId,
        structureId: structureAId,
        levelPosition: 1,
        name: 'Casa 1',
      })
      .returning();
    unitAId = unitA.id;

    const personByAccount = await createPerson('Cuenta', 'Nueva');
    const account = await createAccount(
      personByAccount.id,
      `qa-events-account-${runId}@test.local`,
    );
    const directPerson = await createPerson('Persona', 'Directa');
    const unknownActorId = randomUUID();
    const passCreator = await createPerson('Residente', 'Creador');
    const passAuthorizer = await createPerson('Admin', 'Autoriza');
    const guardPerson = await createPerson('Carlos', 'Guardia');

    const orgAdminPerson = await createPerson('Org', 'Admin');
    const orgAdminAccount = await createAccount(
      orgAdminPerson.id,
      `qa-events-org-admin-${runId}@test.local`,
    );
    const orgAdminMembership = await createMembership(
      orgAdminPerson.id,
      organizationAId,
      null,
      'org_admin',
    );

    const communityAdminPerson = await createPerson('Comunidad', 'Admin');
    const communityAdminAccount = await createAccount(
      communityAdminPerson.id,
      `qa-events-community-admin-${runId}@test.local`,
    );
    const communityAdminMembership = await createMembership(
      communityAdminPerson.id,
      organizationAId,
      communityAId,
      'community_admin',
    );

    const [createdPass] = await db
      .insert(accessPasses)
      .values({
        communityId: communityAId,
        locationUnitId: unitAId,
        structureId: structureAId,
        createdByPersonId: passCreator.id,
        authorizedByPersonId: passAuthorizer.id,
        visitorFirstName: 'Visitante',
        visitorLastName: 'Trazable',
        visitorDocument: 'DOC-1',
        type: 'entry_exit',
        validFrom: new Date(Date.now() - 60 * 60 * 1000),
        validUntil: new Date(Date.now() + 60 * 60 * 1000),
        linkTokenHash: randomUUID().replace(/-/g, ''),
        linkExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      })
      .returning();
    passId = createdPass.id;

    const [createdScan] = await db
      .insert(passScans)
      .values({
        passId,
        guardPersonId: guardPerson.id,
        communityId: communityAId,
        locationUnitId: unitAId,
        structureId: structureAId,
        accessPointId: accessPointAId,
        accessPointName: `Portón A ${runId}`,
        visitorFirstName: 'Visitante',
        visitorLastName: 'Trazable',
        visitorDocument: 'DOC-1',
        action: 'entry',
        result: 'authorized',
        status: 'confirmed',
        tokenJti: randomUUID(),
        scannedAt: new Date(Date.now() - 30 * 1000),
        confirmedAt: new Date(Date.now() - 20 * 1000),
      })
      .returning();
    scanId = createdScan.id;

    await db.insert(events).values([
      {
        eventType: 'qa.account.actor',
        actorId: account.id,
        organizationId: organizationAId,
        communityId: communityAId,
        accessPointId: accessPointAId,
      },
      {
        eventType: 'qa.person.actor',
        actorPersonId: directPerson.id,
        organizationId: organizationAId,
        communityId: communityAId,
      },
      {
        eventType: 'qa.unknown.actor',
        actorId: unknownActorId,
        organizationId: organizationAId,
        communityId: communityAId,
      },
      {
        eventType: 'qa.org.b.event',
        organizationId: organizationBId,
        communityId: communityBId,
      },
      {
        eventType: 'pass.entry',
        actorId: account.id,
        actorRole: 'guard',
        organizationId: organizationAId,
        communityId: communityAId,
        accessPointId: accessPointAId,
        metadata: { passId, scanId, action: 'entry' },
      },
    ]);

    platformToken = tokenFor({
      accountId: orgAdminAccount.id,
      personId: orgAdminPerson.id,
      orgId: '',
      communityId: null,
      role: 'org_admin',
      isPlatformAdmin: true,
      membershipId: 'platform',
    });
    orgAdminToken = tokenFor({
      accountId: orgAdminAccount.id,
      personId: orgAdminPerson.id,
      orgId: organizationAId,
      communityId: null,
      role: 'org_admin',
      membershipId: orgAdminMembership.id,
    });
    communityAdminToken = tokenFor({
      accountId: communityAdminAccount.id,
      personId: communityAdminPerson.id,
      orgId: organizationAId,
      communityId: communityAId,
      role: 'community_admin',
      membershipId: communityAdminMembership.id,
    });
  });

  after(async () => {
    await app.close();
    await db
      .delete(events)
      .where(inArray(events.organizationId, [organizationAId, organizationBId]));
    await db.delete(passScans).where(eq(passScans.passId, passId));
    await db.delete(accessPasses).where(eq(accessPasses.id, passId));
    await db.delete(locationUnits).where(eq(locationUnits.id, unitAId));
    await db.delete(locationStructures).where(eq(locationStructures.id, structureAId));
    await db
      .delete(accessPoints)
      .where(inArray(accessPoints.communityId, [communityAId, communityBId]));
    await db.delete(memberships).where(inArray(memberships.id, membershipIds));
    await db.delete(accounts).where(inArray(accounts.id, accountIds));
    await db.delete(people).where(inArray(people.id, personIds));
    await db.delete(communities).where(inArray(communities.id, [communityAId, communityBId]));
    await db
      .delete(organizations)
      .where(inArray(organizations.id, [organizationAId, organizationBId]));
  });

  it('resuelve el nombre del actor por persona y por cuenta', async () => {
    const result = await listEvents({ page: 1, pageSize: 50, organizationId: organizationAId });
    const byType = new Map(result.data.map((event) => [event.eventType, event]));

    assert.equal(byType.get('qa.account.actor')?.actorName, 'Cuenta Nueva');
    assert.equal(byType.get('qa.person.actor')?.actorName, 'Persona Directa');
    // Un actor que ya no existe en people ni en accounts no rompe la consulta:
    // la tabla legada `users` se retiró y no hay un tercer fallback.
    assert.equal(byType.get('qa.unknown.actor')?.actorName, null);
  });

  it('rechaza con 403 a los roles tenant', async () => {
    const orgAdmin = await request('/api/events', orgAdminToken);
    assert.equal(orgAdmin.statusCode, 403, orgAdmin.body);
    assert.equal(parse(orgAdmin).error, 'Forbidden');

    const communityAdmin = await request('/api/events', communityAdminToken);
    assert.equal(communityAdmin.statusCode, 403, communityAdmin.body);
  });

  it('el superadmin lee eventos de todas las organizaciones', async () => {
    const response = await request('/api/events?pageSize=100', platformToken);
    assert.equal(response.statusCode, 200, response.body);

    const body = JSON.parse(response.body) as EventsResponse;
    const organizationIds = new Set(body.data.map((event) => event.organizationId));
    assert.ok(organizationIds.has(organizationAId));
    assert.ok(organizationIds.has(organizationBId));
  });

  it('acota por organización, comunidad y tipo de evento', async () => {
    const byOrganization = await request(
      `/api/events?pageSize=100&organizationId=${organizationBId}`,
      platformToken,
    );
    assert.equal(byOrganization.statusCode, 200, byOrganization.body);
    const organizationBody = JSON.parse(byOrganization.body) as EventsResponse;
    assert.ok(organizationBody.data.length > 0);
    assert.ok(
      organizationBody.data.every((event) => event.organizationId === organizationBId),
      'la organización pedida acota todas las filas',
    );

    const byCommunity = await request(
      `/api/events?pageSize=100&communityId=${communityBId}`,
      platformToken,
    );
    const communityBody = JSON.parse(byCommunity.body) as EventsResponse;
    assert.ok(communityBody.data.length > 0);
    assert.ok(communityBody.data.every((event) => event.communityId === communityBId));

    const byType = await request(
      `/api/events?pageSize=100&organizationId=${organizationAId}&eventType=pass.entry`,
      platformToken,
    );
    const typeBody = JSON.parse(byType.body) as EventsResponse;
    assert.equal(typeBody.data.length, 1);
    assert.equal(typeBody.data[0]?.eventType, 'pass.entry');

    const byActor = await request(
      `/api/events?pageSize=100&organizationId=${organizationAId}&actor=Cuenta`,
      platformToken,
    );
    const actorBody = JSON.parse(byActor.body) as EventsResponse;
    assert.ok(actorBody.data.length > 0);
    assert.ok(actorBody.data.every((event) => event.actorName === 'Cuenta Nueva'));
  });

  it('incluye organización, comunidad y acceso del evento', async () => {
    const response = await request(
      `/api/events?pageSize=100&organizationId=${organizationAId}&eventType=pass.entry`,
      platformToken,
    );
    const body = JSON.parse(response.body) as EventsResponse;
    const [event] = body.data;

    assert.equal(event?.organizationName, `qa-events-a-${runId}`);
    assert.equal(event?.communityName, `Comunidad A ${runId}`);
    assert.equal(event?.accessPointName, `Portón A ${runId}`);
    assert.equal(event?.actorName, 'Cuenta Nueva');
  });

  it('expone la trazabilidad del pase cuando el evento trae passId', async () => {
    const response = await request(
      `/api/events?pageSize=100&organizationId=${organizationAId}&eventType=pass.entry`,
      platformToken,
    );
    const body = JSON.parse(response.body) as EventsResponse;
    const trace = body.data[0]?.trace;

    assert.ok(trace, 'el evento con passId debe traer trazabilidad');
    assert.equal(trace?.passCode, passId);
    assert.equal(trace?.visitorName, 'Visitante Trazable');
    assert.equal(trace?.passCreatedBy, 'Residente Creador');
    assert.equal(trace?.authorizedBy, 'Admin Autoriza');
    assert.equal(trace?.scanId, scanId);
    assert.equal(trace?.scanStatus, 'confirmed');
    assert.ok(trace?.passCreatedAt);
    assert.ok(trace?.scannedAt);
    assert.ok(trace?.confirmedAt);
  });
});
