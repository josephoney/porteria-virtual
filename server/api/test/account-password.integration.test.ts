import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import type { FastifyInstance } from 'fastify';

process.env.OUTBOX_WORKER_ENABLED = 'false';
process.env.NODE_ENV = 'test';

import bcrypt from 'bcryptjs';
import { eq, inArray } from 'drizzle-orm';

import { createDb } from '@porteria/database';
import {
  accounts,
  communities,
  events,
  memberships,
  organizations,
  people,
  refreshTokens,
} from '@porteria/database/schema';

const db = createDb();

let app: FastifyInstance;
let orgId: string;
let communityId: string;
let orgAdminToken: string;
let communityAdminToken: string;
let operatorAccountId: string;
let peerAdminAccountId: string;
let operatorSessionId: string;

const personIds: string[] = [];
const accountIds: string[] = [];

async function makeAccount(firstName: string, role: string, community: string | null) {
  const suffix = randomUUID().slice(0, 8);
  const [person] = await db
    .insert(people)
    .values({ firstName, lastName: 'Prueba', documentType: 'CC' })
    .returning();
  personIds.push(person.id);

  const [account] = await db
    .insert(accounts)
    .values({
      personId: person.id,
      email: `${role}-${suffix}@test.local`,
      passwordHash: await bcrypt.hash('inicial-123', 10),
    })
    .returning();
  accountIds.push(account.id);

  const [membership] = await db
    .insert(memberships)
    .values({
      personId: person.id,
      accountId: account.id,
      organizationId: orgId,
      communityId: community,
      role,
    })
    .returning();

  const token = app.jwt.sign({
    sub: account.id,
    email: account.email,
    accountId: account.id,
    personId: person.id,
    orgId,
    membershipId: membership.id,
    role,
    communityId: community,
    unitId: null,
    isPlatformAdmin: false,
  });

  return { accountId: account.id, personId: person.id, token };
}

function post(url: string, token: string, payload: Record<string, unknown>) {
  return app.inject({
    method: 'POST',
    url,
    payload,
    headers: { authorization: `Bearer ${token}` },
  });
}

describe('cambio de contraseña por el administrador', () => {
  before(async () => {
    const suffix = randomUUID().slice(0, 8);
    const { buildApp } = await import('../src/index.js');
    app = (await buildApp()).app;

    const [org] = await db
      .insert(organizations)
      .values({ name: `Org claves ${suffix}`, slug: `org-claves-${suffix}` })
      .returning();
    orgId = org.id;

    const [community] = await db
      .insert(communities)
      .values({
        organizationId: orgId,
        name: `Conjunto claves ${suffix}`,
        slug: `conjunto-claves-${suffix}`,
        address: 'Calle 1',
      })
      .returning();
    communityId = community.id;

    const orgAdmin = await makeAccount('Jefa', 'org_admin', null);
    orgAdminToken = orgAdmin.token;
    const communityAdmin = await makeAccount('Coordina', 'community_admin', communityId);
    communityAdminToken = communityAdmin.token;
    const operator = await makeAccount('Opera', 'operator', communityId);
    operatorAccountId = operator.accountId;
    const peer = await makeAccount('Par', 'community_admin', communityId);
    peerAdminAccountId = peer.accountId;

    const [session] = await db
      .insert(refreshTokens)
      .values({
        accountId: operatorAccountId,
        tokenHash: randomUUID().replace(/-/g, ''),
        expiresAt: new Date(Date.now() + 86_400_000),
      })
      .returning();
    operatorSessionId = session.id;
  });

  after(async () => {
    await db.delete(refreshTokens).where(inArray(refreshTokens.accountId, accountIds));
    await db.delete(memberships).where(inArray(memberships.personId, personIds));
    await db.delete(accounts).where(inArray(accounts.id, accountIds));
    await db.delete(people).where(inArray(people.id, personIds));
    await db.delete(communities).where(eq(communities.id, communityId));
    await db.delete(organizations).where(eq(organizations.id, orgId));
    await app.close();
  });

  it('permite al administrador de organización definir una temporal', async () => {
    const response = await post(`/api/accounts/${operatorAccountId}/password`, orgAdminToken, {
      mode: 'direct',
      password: 'temporal-456',
      mustChange: true,
    });

    assert.equal(response.statusCode, 200, response.body);
    const body = JSON.parse(response.body).data as { mode: string; temporaryPassword: string };
    assert.equal(body.mode, 'direct');
    // La contraseña se devuelve una sola vez, para que el administrador la
    // entregue; no se guarda en ningún otro lugar.
    assert.equal(body.temporaryPassword, 'temporal-456');

    const [account] = await db
      .select()
      .from(accounts)
      .where(eq(accounts.id, operatorAccountId))
      .limit(1);
    assert.equal(await bcrypt.compare('temporal-456', account.passwordHash), true);
    assert.equal(account.mustChangePassword, true);
  });

  it('revoca las sesiones abiertas de la cuenta', async () => {
    const [session] = await db
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.id, operatorSessionId))
      .limit(1);
    assert.equal(session.revoked, true);
  });

  it('registra el evento sin la contraseña', async () => {
    const rows = await db
      .select()
      .from(events)
      .where(eq(events.eventType, 'account.password.reset'));
    const recent = rows.filter(
      (row) =>
        (row.metadata as { targetAccountId?: string })?.targetAccountId === operatorAccountId,
    );
    assert.ok(recent.length >= 1);
    assert.ok(!JSON.stringify(recent).includes('temporal-456'));
  });

  it('niega el reseteo de un par con el mismo rol', async () => {
    const response = await post(
      `/api/accounts/${peerAdminAccountId}/password`,
      communityAdminToken,
      { mode: 'direct', password: 'otra-clave-789' },
    );
    assert.equal(response.statusCode, 403);
  });

  it('niega una contraseña demasiado corta', async () => {
    const response = await post(`/api/accounts/${operatorAccountId}/password`, orgAdminToken, {
      mode: 'direct',
      password: 'corta',
    });
    assert.equal(response.statusCode, 400);
  });

  it('niega un modo desconocido', async () => {
    const response = await post(`/api/accounts/${operatorAccountId}/password`, orgAdminToken, {
      mode: 'otro',
    });
    assert.equal(response.statusCode, 400);
  });

  it('niega tocar una cuenta de otra organización', async () => {
    const otherOrg = await makeAccount('Ajena', 'operator', null);
    // La cuenta existe pero no pertenece a la organización del actor.
    const response = await post(
      `/api/accounts/${otherOrg.accountId}/password`,
      communityAdminToken,
      { mode: 'direct', password: 'clave-ajena-123' },
    );
    assert.equal(response.statusCode, 403);
  });
});
