import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import type { FastifyInstance } from 'fastify';

process.env.OUTBOX_WORKER_ENABLED = 'false';
process.env.DYNAMIC_QR_ENABLED = 'true';
process.env.PASS_QR_SECRET = 'integration-pass-secret';
process.env.PASS_WEB_URL = 'http://localhost:5176';
process.env.PASS_ALERT_WORKER_ENABLED = 'false';

import { createDb } from '@porteria/database';
import { and, eq } from 'drizzle-orm';
import {
  accessPasses,
  accounts,
  communities,
  locationStructures,
  locationUnits,
  memberships,
  organizations,
  passAlerts,
  people,
  users,
} from '@porteria/database/schema';
let sweep: () => Promise<unknown>;

const db = createDb();

let app: FastifyInstance;
let organizationId: string;
let communityId: string;
let unitId: string;
let residentToken: string;

type Json = Record<string, any>;

function parse(response: { body: string }): Json {
  return JSON.parse(response.body) as Json;
}

async function createPass(document: string) {
  const response = await app.inject({
    method: 'POST',
    url: '/api/passes',
    headers: { authorization: `Bearer ${residentToken}` },
    payload: {
      locationUnitId: unitId,
      visitorFirstName: 'Alerta',
      visitorLastName: 'Salida',
      visitorDocument: document,
      type: 'entry_exit',
      validFrom: new Date(Date.now() - 4 * 3_600_000).toISOString(),
      validUntil: new Date(Date.now() + 3_600_000).toISOString(),
    },
  });
  assert.equal(response.statusCode, 201, response.body);
  return parse(response).pass.id as string;
}

/** Leaves the pass inside, with a window that ended long enough to be overdue. */
async function leaveInsideAndOverdue(passId: string) {
  await db
    .update(accessPasses)
    .set({
      presenceState: 'inside',
      entryCount: 1,
      entryAt: new Date(Date.now() - 5 * 3_600_000),
      validUntil: new Date(Date.now() - 3 * 3_600_000),
    })
    .where(eq(accessPasses.id, passId));
}

describe('missing exit alerts', () => {
  before(async () => {
    const { buildApp } = await import('../src/index.js');
    app = (await buildApp()).app;
    const worker = await import('../src/workers/pass-alerts.worker.js');
    sweep = worker.sweepPassAlerts;

    const suffix = randomUUID().slice(0, 8);
    const [organization] = await db
      .insert(organizations)
      .values({ name: `Org alertas ${suffix}`, slug: `org-alertas-${suffix}` })
      .returning();
    organizationId = organization.id;

    const [community] = await db
      .insert(communities)
      .values({
        organizationId,
        name: `Comunidad alertas ${suffix}`,
        slug: `comunidad-alertas-${suffix}`,
        address: 'Calle 2',
        timezone: 'America/Bogota',
        passDailyLimitEnabled: false,
      })
      .returning();
    communityId = community.id;

    const [structure] = await db
      .insert(locationStructures)
      .values({ communityId, name: 'Estructura', levelCount: 1, level1Name: 'Casa' })
      .returning();
    const [unit] = await db
      .insert(locationUnits)
      .values({ communityId, structureId: structure.id, levelPosition: 1, name: 'Casa 1' })
      .returning();
    unitId = unit.id;

    const [person] = await db
      .insert(people)
      .values({ firstName: 'Resi', lastName: 'Alerta' })
      .returning();
    const [user] = await db
      .insert(users)
      .values({
        personId: person.id,
        name: 'Resi Alerta',
        email: `residente-alertas-${suffix}@test.local`,
        passwordHash: 'x',
      })
      .returning();
    const [account] = await db
      .insert(accounts)
      .values({
        personId: person.id,
        email: `residente-alertas-${suffix}@test.local`,
        passwordHash: 'x',
      })
      .returning();
    const [membership] = await db
      .insert(memberships)
      .values({
        userId: user.id,
        personId: person.id,
        organizationId,
        communityId,
        role: 'owner',
        status: 'active',
        locationUnitId: unitId,
      })
      .returning();

    residentToken = app.jwt.sign({
      sub: user.id,
      accountId: account.id,
      personId: person.id,
      role: 'owner',
      orgId: organizationId,
      communityId,
      membershipId: membership.id,
      isPlatformAdmin: false,
    });
  });

  after(async () => {
    await db.delete(passAlerts).where(eq(passAlerts.communityId, communityId));
    await db.delete(accessPasses).where(eq(accessPasses.communityId, communityId));
    await db.delete(organizations).where(eq(organizations.id, organizationId));
    await app.close();
  });

  it('creates one alert for a visitor who never left, and does not duplicate it', async () => {
    const passId = await createPass(`ALERTA-${randomUUID().slice(0, 8)}`);
    await leaveInsideAndOverdue(passId);

    await sweep();
    await sweep();

    const alerts = await db
      .select()
      .from(passAlerts)
      .where(and(eq(passAlerts.passId, passId), eq(passAlerts.status, 'open')));

    assert.equal(alerts.length, 1, 'a second sweep must not duplicate the alert');
    assert.equal(alerts[0].type, 'missing_exit');
  });

  it('does not flag a visitor who is still inside and within the window', async () => {
    const passId = await createPass(`ADENTRO-${randomUUID().slice(0, 8)}`);
    await db
      .update(accessPasses)
      .set({ presenceState: 'inside', entryCount: 1, entryAt: new Date() })
      .where(eq(accessPasses.id, passId));

    await sweep();

    const alerts = await db.select().from(passAlerts).where(eq(passAlerts.passId, passId));
    assert.equal(alerts.length, 0);
  });

  it('does not flag a visitor who already left', async () => {
    const passId = await createPass(`SALIO-${randomUUID().slice(0, 8)}`);
    await db
      .update(accessPasses)
      .set({
        presenceState: 'outside',
        exitCount: 1,
        validUntil: new Date(Date.now() - 3 * 3_600_000),
      })
      .where(eq(accessPasses.id, passId));

    await sweep();

    const alerts = await db.select().from(passAlerts).where(eq(passAlerts.passId, passId));
    assert.equal(alerts.length, 0);
  });
});
