import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import type { FastifyInstance } from 'fastify';

process.env.OUTBOX_WORKER_ENABLED = 'false';
process.env.NODE_ENV = 'test';

import { createDb } from '@porteria/database';
import { inArray } from 'drizzle-orm';
import {
  accessPoints,
  accounts,
  bitacoraEntries,
  communities,
  memberships,
  organizations,
  people,
} from '@porteria/database/schema';

const db = createDb();

let app: FastifyInstance;
let orgAId: string;
let orgBId: string;
let communityA1Id: string;
let communityA2Id: string;
let communityB1Id: string;
let accessPointA1Id: string;
let accessPointA2Id: string;
let accessPointB1Id: string;
let guardAId: string;
let guardBId: string;
let platformToken: string;
let communityAdminA1Token: string;
let orgAdminAToken: string;
let operatorA1Token: string;
let residentToken: string;
const entryIds: string[] = [];
const personIds: string[] = [];
const accountIds: string[] = [];
const membershipIds: string[] = [];

type Json = Record<string, unknown>;

function auth(token: string) {
  return { authorization: `Bearer ${token}` };
}

async function request(method: 'GET', url: string, token: string) {
  return app.inject({ method, url, headers: auth(token) });
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
  const [person] = await db
    .insert(people)
    .values({ firstName, lastName, status: 'active' })
    .returning();
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
  role: 'guard' | 'community_admin' | 'org_admin' | 'operator' | 'resident',
) {
  const [membership] = await db
    .insert(memberships)
    .values({
      personId,
      organizationId,
      communityId,
      role,
      status: 'active',
    })
    .returning();
  membershipIds.push(membership.id);
  return membership;
}

async function createGuardMembership(
  personId: string,
  organizationId: string,
  communityId: string,
) {
  return createMembership(personId, organizationId, communityId, 'guard');
}

async function insertEntry(input: {
  communityId: string;
  accessPointId: string;
  accessPointName: string;
  type: 'pass_entry' | 'pass_exit' | 'pass_rejected' | 'scan_denied' | 'manual';
  authorPersonId?: string | null;
  details?: Record<string, unknown>;
  summary?: string;
}) {
  const [entry] = await db
    .insert(bitacoraEntries)
    .values({
      communityId: input.communityId,
      accessPointId: input.accessPointId,
      accessPointName: input.accessPointName,
      type: input.type,
      source: input.type === 'manual' ? 'dashboard' : 'app',
      authorPersonId: input.authorPersonId ?? null,
      summary: input.summary ?? `Evento ${input.type}`,
      details: input.details ?? {},
    })
    .returning();
  entryIds.push(entry.id);
  return entry;
}

describe('access bitacora scoping and filters', () => {
  before(async () => {
    const suffix = randomUUID().slice(0, 8);
    const { buildApp } = await import('../src/index.js');
    app = (await buildApp()).app;

    const [orgA] = await db
      .insert(organizations)
      .values({ name: `Bitacora Org A ${suffix}`, slug: `bitacora-org-a-${suffix}` })
      .returning();
    orgAId = orgA.id;
    const [orgB] = await db
      .insert(organizations)
      .values({ name: `Bitacora Org B ${suffix}`, slug: `bitacora-org-b-${suffix}` })
      .returning();
    orgBId = orgB.id;

    const [communityA1, communityA2, communityB1] = await db
      .insert(communities)
      .values([
        {
          organizationId: orgAId,
          name: `Comunidad A1 ${suffix}`,
          slug: `bitacora-a1-${suffix}`,
          address: 'Calle A1',
          timezone: 'UTC',
        },
        {
          organizationId: orgAId,
          name: `Comunidad A2 ${suffix}`,
          slug: `bitacora-a2-${suffix}`,
          address: 'Calle A2',
          timezone: 'UTC',
        },
        {
          organizationId: orgBId,
          name: `Comunidad B1 ${suffix}`,
          slug: `bitacora-b1-${suffix}`,
          address: 'Calle B1',
          timezone: 'UTC',
        },
      ])
      .returning();
    communityA1Id = communityA1.id;
    communityA2Id = communityA2.id;
    communityB1Id = communityB1.id;

    const [accessPointA1, accessPointA2, accessPointB1] = await db
      .insert(accessPoints)
      .values([
        { communityId: communityA1Id, name: `Portón A1 ${suffix}`, type: 'gate' },
        { communityId: communityA2Id, name: `Portón A2 ${suffix}`, type: 'gate' },
        { communityId: communityB1Id, name: `Portón B1 ${suffix}`, type: 'gate' },
      ])
      .returning();
    accessPointA1Id = accessPointA1.id;
    accessPointA2Id = accessPointA2.id;
    accessPointB1Id = accessPointB1.id;

    const guardA = await createPerson('Guardia', 'Alfa');
    guardAId = guardA.id;
    const guardB = await createPerson('Guardia', 'Beta');
    guardBId = guardB.id;
    const communityAdminA1 = await createPerson('Admin', 'Comunidad A1');
    const orgAdminA = await createPerson('Admin', 'Organización A');
    const operatorA1 = await createPerson('Operador', 'Comunidad A1');
    const resident = await createPerson('Residente', 'Sin Acceso');

    await createGuardMembership(guardAId, orgAId, communityA1Id);
    await createGuardMembership(guardBId, orgBId, communityB1Id);

    const communityAdminMembership = await createMembership(
      communityAdminA1.id,
      orgAId,
      communityA1Id,
      'community_admin',
    );
    const orgAdminMembership = await createMembership(orgAdminA.id, orgAId, null, 'org_admin');
    const operatorMembership = await createMembership(
      operatorA1.id,
      orgAId,
      communityA1Id,
      'operator',
    );
    const residentMembership = await createMembership(
      resident.id,
      orgAId,
      communityA1Id,
      'resident',
    );

    const platformAccount = await createAccount(
      (await createPerson('Super', 'Admin')).id,
      `bitacora-platform-${suffix}@test.local`,
    );
    const communityAdminAccount = await createAccount(
      communityAdminA1.id,
      `bitacora-community-${suffix}@test.local`,
    );
    const orgAdminAccount = await createAccount(orgAdminA.id, `bitacora-org-${suffix}@test.local`);
    const operatorAccount = await createAccount(
      operatorA1.id,
      `bitacora-operator-${suffix}@test.local`,
    );
    const residentAccount = await createAccount(
      resident.id,
      `bitacora-resident-${suffix}@test.local`,
    );

    platformToken = tokenFor({
      accountId: platformAccount.id,
      personId: platformAccount.personId,
      orgId: '',
      communityId: null,
      role: 'staff',
      isPlatformAdmin: true,
      membershipId: 'platform',
    });
    communityAdminA1Token = tokenFor({
      accountId: communityAdminAccount.id,
      personId: communityAdminA1.id,
      orgId: orgAId,
      communityId: communityA1Id,
      role: 'community_admin',
      membershipId: communityAdminMembership.id,
    });
    orgAdminAToken = tokenFor({
      accountId: orgAdminAccount.id,
      personId: orgAdminA.id,
      orgId: orgAId,
      communityId: null,
      role: 'org_admin',
      membershipId: orgAdminMembership.id,
    });
    operatorA1Token = tokenFor({
      accountId: operatorAccount.id,
      personId: operatorA1.id,
      orgId: orgAId,
      communityId: communityA1Id,
      role: 'operator',
      membershipId: operatorMembership.id,
    });
    residentToken = tokenFor({
      accountId: residentAccount.id,
      personId: resident.id,
      orgId: orgAId,
      communityId: communityA1Id,
      role: 'resident',
      membershipId: residentMembership.id,
    });

    await insertEntry({
      communityId: communityA1Id,
      accessPointId: accessPointA1Id,
      accessPointName: accessPointA1.name,
      type: 'pass_entry',
      authorPersonId: guardAId,
      summary: 'Ingresó Visitante Alfa',
      details: {
        action: 'entry',
        visitor: { firstName: 'Visitante', lastName: 'Alfa', document: '10101010' },
        vehiclePlate: 'ABC123',
        destinationName: 'Torre A',
        destinationKind: 'section',
      },
    });
    await insertEntry({
      communityId: communityA1Id,
      accessPointId: accessPointA1Id,
      accessPointName: accessPointA1.name,
      type: 'pass_rejected',
      authorPersonId: guardAId,
      summary: 'Ingreso rechazado',
      details: { reason: 'denied_by_guard', action: 'entry' },
    });
    await insertEntry({
      communityId: communityA1Id,
      accessPointId: accessPointA1Id,
      accessPointName: accessPointA1.name,
      type: 'scan_denied',
      authorPersonId: guardAId,
      summary: 'Escaneo denegado: expired',
      details: { reason: 'expired', action: 'entry' },
    });
    await insertEntry({
      communityId: communityA1Id,
      accessPointId: accessPointA1Id,
      accessPointName: accessPointA1.name,
      type: 'manual',
      authorPersonId: guardAId,
      summary: 'Novedad de portería',
      details: { note: 'Paquete recibido' },
    });
    await insertEntry({
      communityId: communityA2Id,
      accessPointId: accessPointA2Id,
      accessPointName: accessPointA2.name,
      type: 'pass_entry',
      authorPersonId: null,
      summary: 'Ingresó Visitante A2',
      details: { visitor: { firstName: 'Visitante', lastName: 'A2' } },
    });
    await insertEntry({
      communityId: communityB1Id,
      accessPointId: accessPointB1Id,
      accessPointName: accessPointB1.name,
      type: 'pass_entry',
      authorPersonId: guardBId,
      summary: 'Ingresó Visitante B1',
      details: { visitor: { firstName: 'Visitante', lastName: 'B1' } },
    });
  });

  after(async () => {
    if (entryIds.length) {
      await db.delete(bitacoraEntries).where(inArray(bitacoraEntries.id, entryIds));
    }
    if (membershipIds.length) {
      await db.delete(memberships).where(inArray(memberships.id, membershipIds));
    }
    if (accountIds.length) await db.delete(accounts).where(inArray(accounts.id, accountIds));
    if (personIds.length) await db.delete(people).where(inArray(people.id, personIds));
    if (communityA1Id) {
      await db
        .delete(accessPoints)
        .where(inArray(accessPoints.id, [accessPointA1Id, accessPointA2Id, accessPointB1Id]));
      await db
        .delete(communities)
        .where(inArray(communities.id, [communityA1Id, communityA2Id, communityB1Id]));
    }
    if (orgAId) await db.delete(organizations).where(inArray(organizations.id, [orgAId, orgBId]));
    await app.close();
  });

  it('lets a platform admin read across organizations without communityId', async () => {
    const response = await request('GET', '/api/bitacora?pageSize=100', platformToken);
    assert.equal(response.statusCode, 200, response.body);

    const items = parse(response).items as Json[];
    const communityIdsSeen = new Set(items.map((item) => item.communityId));
    assert.equal(communityIdsSeen.has(communityA1Id), true);
    assert.equal(communityIdsSeen.has(communityB1Id), true);

    const entry = items.find(
      (item) => item.communityId === communityA1Id && item.result === 'authorized',
    );
    assert.ok(entry);
    assert.equal(String(entry.communityName).startsWith('Comunidad A1'), true);
    assert.equal(entry.source === 'app', true);
    assert.equal(entry.guardName, 'Guardia Alfa');
    const details = entry.details as { visitor?: { document?: string } };
    assert.equal(details.visitor?.document, '***1010');
  });

  it('keeps a tenant role inside its own community', async () => {
    const response = await request('GET', '/api/bitacora?pageSize=100', communityAdminA1Token);
    assert.equal(response.statusCode, 200, response.body);
    const body = parse(response);
    assert.equal(body.total, 4);
    assert.equal(
      (body.items as Json[]).every((item) => item.communityId === communityA1Id),
      true,
    );

    const foreign = await request(
      'GET',
      `/api/bitacora?communityId=${communityB1Id}&pageSize=100`,
      communityAdminA1Token,
    );
    assert.equal(foreign.statusCode, 200, foreign.body);
    assert.equal(parse(foreign).total, 0);
  });

  it('narrows the rows by guard', async () => {
    const response = await request(
      'GET',
      `/api/bitacora?guardId=${guardAId}&pageSize=100`,
      platformToken,
    );
    assert.equal(response.statusCode, 200, response.body);
    const items = parse(response).items as Json[];
    assert.equal(items.length >= 4, true);
    assert.equal(
      items.every((item) => item.guardPersonId === guardAId),
      true,
    );
    assert.equal(
      items.some((item) => item.guardPersonId === guardBId),
      false,
    );
  });

  it('narrows the rows by derived result', async () => {
    const codeFailure = await request(
      'GET',
      `/api/bitacora?guardId=${guardAId}&result=code_failure&pageSize=100`,
      platformToken,
    );
    assert.equal(codeFailure.statusCode, 200, codeFailure.body);
    const codeFailureItems = parse(codeFailure).items as Json[];
    assert.equal(codeFailureItems.length, 1);
    assert.equal(codeFailureItems[0].result, 'code_failure');
    assert.equal(codeFailureItems[0].type, 'scan_denied');

    const denied = await request(
      'GET',
      `/api/bitacora?guardId=${guardAId}&result=denied&pageSize=100`,
      platformToken,
    );
    assert.equal(denied.statusCode, 200, denied.body);
    const deniedItems = parse(denied).items as Json[];
    assert.equal(deniedItems.length, 1);
    assert.equal(deniedItems[0].result, 'denied');

    const observation = await request(
      'GET',
      `/api/bitacora?guardId=${guardAId}&result=observation&pageSize=100`,
      platformToken,
    );
    assert.equal(observation.statusCode, 200, observation.body);
    const observationItems = parse(observation).items as Json[];
    assert.equal(observationItems.length, 1);
    assert.equal(observationItems[0].type, 'manual');
  });

  it('scopes the operator to its community and rejects a non-listed role', async () => {
    const operator = await request('GET', '/api/bitacora?pageSize=100', operatorA1Token);
    assert.equal(operator.statusCode, 200, operator.body);
    const operatorItems = parse(operator).items as Json[];
    assert.equal(
      operatorItems.every((item) => item.communityId === communityA1Id),
      true,
    );

    const resident = await request('GET', '/api/bitacora', residentToken);
    assert.equal(resident.statusCode, 403, resident.body);
  });

  it('lists guards inside the scope for the filter', async () => {
    const response = await request(
      'GET',
      `/api/bitacora/guards?communityId=${communityA1Id}`,
      orgAdminAToken,
    );
    assert.equal(response.statusCode, 200, response.body);
    const items = parse(response).items as Json[];
    assert.equal(
      items.some((item) => item.id === guardAId),
      true,
    );
    assert.equal(
      items.some((item) => item.id === guardBId),
      false,
    );
  });
});
