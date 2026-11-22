import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import type { FastifyInstance } from 'fastify';

// The app starts the outbox worker from config at import time.
process.env.OUTBOX_WORKER_ENABLED = 'false';
process.env.INTERNAL_API_KEY = 'calls-integration-internal-key';

import { createDb } from '@porteria/database';
import {
  accounts,
  calls,
  communities,
  kiosks,
  memberships,
  organizations,
  people,
  users,
} from '@porteria/database/schema';

const db = createDb();
const INTERNAL_KEY = 'calls-integration-internal-key';

let app: FastifyInstance;
let organizationId: string;
let communityId: string;
let kioskId: string;
let orgAdminToken: string;
let operatorPersonId: string;
let operatorUserId: string;
let operatorAccountId: string;
let otherPersonId: string;
let unassignedCallId: string;

interface CallRow {
  id: string;
  operatorName: string | null;
}

function authHeaders() {
  return { authorization: `Bearer ${orgAdminToken}` };
}

async function listCalls(query: string) {
  const res = await app.inject({
    method: 'GET',
    url: `/api/calls?${query}`,
    headers: authHeaders(),
  });
  assert.equal(res.statusCode, 200);
  return res.json() as { data: CallRow[]; total: number };
}

describe('calls operator integration', () => {
  before(async () => {
    const suffix = randomUUID().slice(0, 8);

    const [organization] = await db
      .insert(organizations)
      .values({ name: `Calls Org ${suffix}`, slug: `calls-org-${suffix}` })
      .returning();
    organizationId = organization.id;

    const [community] = await db
      .insert(communities)
      .values({
        organizationId,
        name: `Calls Community ${suffix}`,
        slug: `calls-community-${suffix}`,
        address: 'Test address',
        timezone: 'UTC',
      })
      .returning();
    communityId = community.id;

    const [kiosk] = await db
      .insert(kiosks)
      .values({ name: `Kiosk ${suffix}`, communityId })
      .returning();
    kioskId = kiosk.id;

    const [operatorPerson] = await db
      .insert(people)
      .values({ firstName: 'Ana', lastName: 'Operadora', status: 'active' })
      .returning();
    operatorPersonId = operatorPerson.id;

    operatorUserId = randomUUID();
    const operatorEmail = `operator-fixture-${suffix}@test.local`;
    await db.insert(users).values({
      id: operatorUserId,
      email: operatorEmail,
      passwordHash: 'not-used',
      name: 'Ana Operadora',
    });
    const [operatorAccount] = await db
      .insert(accounts)
      .values({
        personId: operatorPersonId,
        email: operatorEmail,
        passwordHash: 'not-used',
      })
      .returning({ id: accounts.id });
    operatorAccountId = operatorAccount.id;

    const [otherPerson] = await db
      .insert(people)
      .values({ firstName: 'Bruno', lastName: 'Guardia', status: 'active' })
      .returning();
    otherPersonId = otherPerson.id;

    const [adminPerson] = await db
      .insert(people)
      .values({ firstName: 'Admin', lastName: 'Calls', status: 'active' })
      .returning();
    const adminUserId = randomUUID();
    const adminEmail = `calls-admin-${suffix}@test.local`;
    await db.insert(users).values({
      id: adminUserId,
      email: adminEmail,
      passwordHash: 'not-used',
      name: 'Admin Calls',
    });
    const [adminAccount] = await db
      .insert(accounts)
      .values({
        personId: adminPerson.id,
        email: adminEmail,
        passwordHash: 'not-used',
      })
      .returning({ id: accounts.id });
    const [adminMembership] = await db
      .insert(memberships)
      .values({
        userId: adminUserId,
        personId: adminPerson.id,
        organizationId,
        communityId: null,
        unitId: null,
        role: 'org_admin',
        status: 'active',
      })
      .returning();

    unassignedCallId = randomUUID();
    await db.insert(calls).values([
      {
        id: randomUUID(),
        kioskId,
        organizationId,
        communityId,
        status: 'ended',
        operatorPersonId,
      },
      {
        id: randomUUID(),
        kioskId,
        organizationId,
        communityId,
        status: 'missed',
        operatorPersonId: otherPersonId,
      },
      {
        id: unassignedCallId,
        kioskId,
        organizationId,
        communityId,
        status: 'missed',
      },
    ]);

    const { buildApp } = await import('../src/index.js');
    app = (await buildApp()).app;

    orgAdminToken = app.jwt.sign({
      sub: adminAccount.id,
      email: adminEmail,
      accountId: adminAccount.id,
      personId: adminPerson.id,
      orgId: organizationId,
      membershipId: adminMembership.id,
      role: 'org_admin',
      communityId: null,
      unitId: null,
      isPlatformAdmin: false,
    });
  });

  after(async () => {
    await app.close();
  });

  it('filtra las llamadas por persona y compone el nombre desde people', async () => {
    const { data, total } = await listCalls(`operatorPersonId=${operatorPersonId}&pageSize=10`);

    assert.equal(total, 1);
    assert.equal(data.length, 1);
    assert.equal(data[0].operatorName, 'Ana Operadora');
  });

  it('devuelve todas las llamadas cuando no se filtra por operador', async () => {
    const { total } = await listCalls('pageSize=10');
    assert.equal(total, 3);
  });

  it('asigna el operador por persona desde la ruta interna', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/internal/calls/${unassignedCallId}`,
      headers: { 'x-internal-key': INTERNAL_KEY },
      payload: { status: 'active', operatorPersonId },
    });
    assert.equal(res.statusCode, 200);

    const { data } = await listCalls(`operatorPersonId=${operatorPersonId}&pageSize=10`);
    assert.equal(data.length, 2);
    assert.ok(data.every((row) => row.operatorName === 'Ana Operadora'));
  });

  it('resuelve el id de cuenta heredado a la persona del operador', async () => {
    const callId = randomUUID();
    await db.insert(calls).values({
      id: callId,
      kioskId,
      organizationId,
      communityId,
      status: 'pending',
    });

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/internal/calls/${callId}`,
      headers: { 'x-internal-key': INTERNAL_KEY },
      payload: { status: 'active', operatorId: operatorAccountId },
    });
    assert.equal(res.statusCode, 200);

    const { data } = await listCalls(`operatorPersonId=${operatorPersonId}&pageSize=10`);
    const assigned = data.find((row) => row.id === callId);
    assert.ok(assigned);
    assert.equal(assigned?.operatorName, 'Ana Operadora');
  });
});
