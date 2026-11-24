import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import type { FastifyInstance } from 'fastify';

process.env.OUTBOX_WORKER_ENABLED = 'false';
process.env.NODE_ENV = 'test';

import { createDb } from '@porteria/database';
import {
  accounts,
  calls,
  communities,
  kiosks,
  memberships,
  organizations,
  people,
} from '@porteria/database/schema';
import { inArray } from 'drizzle-orm';

const db = createDb();

let app: FastifyInstance;
let orgAId: string;
let orgBId: string;
let communityA1Id: string;
let communityA2Id: string;
let communityB1Id: string;
let platformToken: string;
let orgAdminAToken: string;
let communityAdminA1Token: string;
let operatorA1Token: string;
let guardA1Token: string;
let residentToken: string;
let reportDate: string;
const kioskIds: string[] = [];
const callIds: string[] = [];
const personIds: string[] = [];
const accountIds: string[] = [];
const membershipIds: string[] = [];

type Json = Record<string, any>;

function auth(token: string) {
  return { authorization: `Bearer ${token}` };
}

async function request(method: 'GET', url: string, token: string) {
  return app.inject({ method, url, headers: auth(token) });
}

function parse(response: { body: string }): Json {
  return JSON.parse(response.body) as Json;
}

async function createUserFixture(input: {
  firstName: string;
  lastName: string;
  email: string;
  organizationId: string;
  communityId: string | null;
  role: 'org_admin' | 'community_admin' | 'operator' | 'guard' | 'resident';
}) {
  const [person] = await db
    .insert(people)
    .values({ firstName: input.firstName, lastName: input.lastName, status: 'active' })
    .returning();
  personIds.push(person.id);

  const [account] = await db
    .insert(accounts)
    .values({ personId: person.id, email: input.email, passwordHash: 'x' })
    .returning();
  accountIds.push(account.id);

  const [membership] = await db
    .insert(memberships)
    .values({
      personId: person.id,
      organizationId: input.organizationId,
      communityId: input.communityId,
      role: input.role,
      status: 'active',
    })
    .returning();
  membershipIds.push(membership.id);

  return { person, account, membership };
}

function tokenFor(claims: {
  accountId: string;
  personId: string;
  membershipId: string;
  orgId: string;
  communityId: string | null;
  role: string;
  isPlatformAdmin?: boolean;
}) {
  return app.jwt.sign({
    sub: claims.accountId,
    email: `${claims.role}-${randomUUID().slice(0, 6)}@test.local`,
    accountId: claims.accountId,
    personId: claims.personId,
    orgId: claims.orgId,
    membershipId: claims.membershipId,
    role: claims.role,
    communityId: claims.communityId,
    unitId: null,
    isPlatformAdmin: claims.isPlatformAdmin ?? false,
  });
}

/** Local calendar day used by the report request. */
function localToday(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * `reports.service` resuelve la fecha contra la medianoche local del servidor.
 * Construimos el mediodía local a partir de las partes de la fecha para que las
 * llamadas de prueba caigan dentro del día pedido en cualquier zona horaria.
 * No usar `new Date(date)`: eso interpreta la fecha como UTC y al oeste de
 * Greenwich cae el día anterior.
 */
function reportTimestamp(date: string): Date {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

describe('report scoping', () => {
  before(async () => {
    const suffix = randomUUID().slice(0, 8);
    reportDate = localToday();
    const { buildApp } = await import('../src/index.js');
    app = (await buildApp()).app;

    const [orgA] = await db
      .insert(organizations)
      .values({ name: `Reportes Org A ${suffix}`, slug: `reportes-org-a-${suffix}` })
      .returning();
    orgAId = orgA.id;
    const [orgB] = await db
      .insert(organizations)
      .values({ name: `Reportes Org B ${suffix}`, slug: `reportes-org-b-${suffix}` })
      .returning();
    orgBId = orgB.id;

    const [communityA1, communityA2, communityB1] = await db
      .insert(communities)
      .values([
        {
          organizationId: orgAId,
          name: `Reportes Comunidad A1 ${suffix}`,
          slug: `reportes-a1-${suffix}`,
          address: 'Calle A1',
          timezone: 'UTC',
        },
        {
          organizationId: orgAId,
          name: `Reportes Comunidad A2 ${suffix}`,
          slug: `reportes-a2-${suffix}`,
          address: 'Calle A2',
          timezone: 'UTC',
        },
        {
          organizationId: orgBId,
          name: `Reportes Comunidad B1 ${suffix}`,
          slug: `reportes-b1-${suffix}`,
          address: 'Calle B1',
          timezone: 'UTC',
        },
      ])
      .returning();
    communityA1Id = communityA1.id;
    communityA2Id = communityA2.id;
    communityB1Id = communityB1.id;

    const [kioskA1, kioskA2, kioskB1] = await db
      .insert(kiosks)
      .values([
        { name: `Kiosco A1 ${suffix}`, communityId: communityA1Id },
        { name: `Kiosco A2 ${suffix}`, communityId: communityA2Id },
        { name: `Kiosco B1 ${suffix}`, communityId: communityB1Id },
      ])
      .returning();
    kioskIds.push(kioskA1.id, kioskA2.id, kioskB1.id);

    // A1 suma 2 llamadas, A2 suma 1 y B1 suma 1. Así el alcance se prueba con números.
    const rows = [
      {
        id: randomUUID(),
        kioskId: kioskA1.id,
        organizationId: orgAId,
        communityId: communityA1Id,
        status: 'ended' as const,
        startedAt: reportTimestamp(reportDate),
      },
      {
        id: randomUUID(),
        kioskId: kioskA1.id,
        organizationId: orgAId,
        communityId: communityA1Id,
        status: 'missed' as const,
        startedAt: reportTimestamp(reportDate),
      },
      {
        id: randomUUID(),
        kioskId: kioskA2.id,
        organizationId: orgAId,
        communityId: communityA2Id,
        status: 'ended' as const,
        startedAt: reportTimestamp(reportDate),
      },
      {
        id: randomUUID(),
        kioskId: kioskB1.id,
        organizationId: orgBId,
        communityId: communityB1Id,
        status: 'ended' as const,
        startedAt: reportTimestamp(reportDate),
      },
    ];
    await db.insert(calls).values(rows);
    callIds.push(...rows.map((row) => row.id));

    // El guard de membresías exige cuenta, persona y membresía reales en el token.
    const platformAccount = randomUUID();
    platformToken = tokenFor({
      accountId: platformAccount,
      personId: randomUUID(),
      membershipId: 'platform',
      orgId: '',
      communityId: null,
      role: 'staff',
      isPlatformAdmin: true,
    });

    const orgAdminA = await createUserFixture({
      firstName: 'Admin',
      lastName: 'Organización A',
      email: `reportes-org-${suffix}@test.local`,
      organizationId: orgAId,
      communityId: null,
      role: 'org_admin',
    });
    orgAdminAToken = tokenFor({
      accountId: orgAdminA.account.id,
      personId: orgAdminA.person.id,
      membershipId: orgAdminA.membership.id,
      orgId: orgAId,
      communityId: null,
      role: 'org_admin',
    });

    const communityAdminA1 = await createUserFixture({
      firstName: 'Admin',
      lastName: 'Comunidad A1',
      email: `reportes-community-${suffix}@test.local`,
      organizationId: orgAId,
      communityId: communityA1Id,
      role: 'community_admin',
    });
    communityAdminA1Token = tokenFor({
      accountId: communityAdminA1.account.id,
      personId: communityAdminA1.person.id,
      membershipId: communityAdminA1.membership.id,
      orgId: orgAId,
      communityId: communityA1Id,
      role: 'community_admin',
    });

    const operatorA1 = await createUserFixture({
      firstName: 'Operador',
      lastName: 'Comunidad A1',
      email: `reportes-operator-${suffix}@test.local`,
      organizationId: orgAId,
      communityId: communityA1Id,
      role: 'operator',
    });
    operatorA1Token = tokenFor({
      accountId: operatorA1.account.id,
      personId: operatorA1.person.id,
      membershipId: operatorA1.membership.id,
      orgId: orgAId,
      communityId: communityA1Id,
      role: 'operator',
    });

    const guardA1 = await createUserFixture({
      firstName: 'Guardia',
      lastName: 'Comunidad A1',
      email: `reportes-guard-${suffix}@test.local`,
      organizationId: orgAId,
      communityId: communityA1Id,
      role: 'guard',
    });
    guardA1Token = tokenFor({
      accountId: guardA1.account.id,
      personId: guardA1.person.id,
      membershipId: guardA1.membership.id,
      orgId: orgAId,
      communityId: communityA1Id,
      role: 'guard',
    });

    const resident = await createUserFixture({
      firstName: 'Residente',
      lastName: 'Sin Acceso',
      email: `reportes-resident-${suffix}@test.local`,
      organizationId: orgAId,
      communityId: communityA1Id,
      role: 'resident',
    });
    residentToken = tokenFor({
      accountId: resident.account.id,
      personId: resident.person.id,
      membershipId: resident.membership.id,
      orgId: orgAId,
      communityId: communityA1Id,
      role: 'resident',
    });
  });

  after(async () => {
    if (callIds.length) await db.delete(calls).where(inArray(calls.id, callIds));
    if (kioskIds.length) await db.delete(kiosks).where(inArray(kiosks.id, kioskIds));
    if (membershipIds.length) {
      await db.delete(memberships).where(inArray(memberships.id, membershipIds));
    }
    if (accountIds.length) await db.delete(accounts).where(inArray(accounts.id, accountIds));
    if (personIds.length) await db.delete(people).where(inArray(people.id, personIds));
    if (orgAId) await db.delete(organizations).where(inArray(organizations.id, [orgAId, orgBId]));
    await app.close();
  });

  it('requires an organizationId for platform reports and reads only that organization', async () => {
    const date = reportDate;

    const missingScope = await request('GET', `/api/reports/daily?date=${date}`, platformToken);
    assert.equal(missingScope.statusCode, 400, missingScope.body);
    assert.match(String(parse(missingScope).error), /organizationId/);

    const orgA = await request(
      'GET',
      `/api/reports/daily?organizationId=${orgAId}&date=${date}`,
      platformToken,
    );
    assert.equal(orgA.statusCode, 200, orgA.body);
    assert.equal(parse(orgA).totalCalls, 3);

    const orgB = await request(
      'GET',
      `/api/reports/daily?organizationId=${orgBId}&date=${date}`,
      platformToken,
    );
    assert.equal(orgB.statusCode, 200, orgB.body);
    assert.equal(parse(orgB).totalCalls, 1);
  });

  it('lets a platform admin load the communities used by the report filter', async () => {
    const response = await request(
      'GET',
      `/api/communities?organizationId=${orgAId}`,
      platformToken,
    );
    assert.equal(response.statusCode, 200, response.body);

    const names = (parse(response) as unknown as Json[]).map((community) => community.name);
    assert.equal(names.length, 2);
    assert.equal(
      names.some((name) => String(name).includes('A1')),
      true,
    );
    assert.equal(
      names.some((name) => String(name).includes('B1')),
      false,
    );
  });

  it('narrows a community_admin asking for another community to its own community', async () => {
    const date = reportDate;
    const response = await request(
      'GET',
      `/api/reports/daily?organizationId=${orgBId}&communityId=${communityB1Id}&date=${date}`,
      communityAdminA1Token,
    );

    assert.equal(response.statusCode, 200, response.body);
    // El query se ignora: el alcance real es organización A y comunidad A1.
    assert.equal(parse(response).totalCalls, 2);
  });

  it('pins guard and operator to their own community', async () => {
    const date = reportDate;
    for (const token of [guardA1Token, operatorA1Token]) {
      const response = await request(
        'GET',
        `/api/reports/daily?organizationId=${orgBId}&communityId=${communityB1Id}&date=${date}`,
        token,
      );
      assert.equal(response.statusCode, 200, response.body);
      assert.equal(parse(response).totalCalls, 2);
    }
  });

  it('narrows an org_admin asking for a foreign community to its own organization', async () => {
    const date = reportDate;

    const foreignCommunity = await request(
      'GET',
      `/api/reports/daily?organizationId=${orgBId}&communityId=${communityB1Id}&date=${date}`,
      orgAdminAToken,
    );
    assert.equal(foreignCommunity.statusCode, 200, foreignCommunity.body);
    // La organización del token manda: comunidad B1 no pertenece a la organización A.
    assert.equal(parse(foreignCommunity).totalCalls, 0);

    const ownCommunity = await request(
      'GET',
      `/api/reports/daily?communityId=${communityA1Id}&date=${date}`,
      orgAdminAToken,
    );
    assert.equal(ownCommunity.statusCode, 200, ownCommunity.body);
    assert.equal(parse(ownCommunity).totalCalls, 2);
  });

  it('rejects a role outside the four report roles', async () => {
    const response = await request('GET', `/api/reports/daily?date=${reportDate}`, residentToken);
    assert.equal(response.statusCode, 403, response.body);
  });
});
