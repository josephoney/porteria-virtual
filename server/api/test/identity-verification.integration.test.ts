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
import { eq, inArray } from 'drizzle-orm';
import {
  accessPasses,
  accessPoints,
  accounts,
  bitacoraEntries,
  communities,
  locationStructures,
  locationUnits,
  memberships,
  guardShiftSegments,
  guardShifts,
  organizations,
  people,
  users,
} from '@porteria/database/schema';

const db = createDb();

let app: FastifyInstance;
let organizationId: string;
let communityId: string;
let unitId: string;
let residentToken: string;
let guardToken: string;
let document: string;

type Json = Record<string, any>;

function parse(response: { body: string }): Json {
  return JSON.parse(response.body) as Json;
}

async function request(method: 'GET' | 'POST', url: string, token: string, payload?: unknown) {
  return app.inject({
    method,
    url,
    headers: { authorization: `Bearer ${token}` },
    payload: payload as Record<string, unknown> | undefined,
  });
}

describe('identity verification by document', () => {
  before(async () => {
    const { buildApp } = await import('../src/index.js');
    app = (await buildApp()).app;

    const suffix = randomUUID().slice(0, 8);
    const [organization] = await db
      .insert(organizations)
      .values({ name: `Org identidad ${suffix}`, slug: `org-identidad-${suffix}` })
      .returning();
    organizationId = organization.id;

    const [community] = await db
      .insert(communities)
      .values({
        organizationId,
        name: `Comunidad identidad ${suffix}`,
        slug: `comunidad-identidad-${suffix}`,
        address: 'Calle 1',
        timezone: 'America/Bogota',
        passDailyLimitEnabled: false,
      })
      .returning();
    communityId = community.id;

    const [structure] = await db
      .insert(locationStructures)
      .values({
        communityId,
        name: 'Estructura',
        levelCount: 1,
        level1Name: 'Casa',
      })
      .returning();

    const [unit] = await db
      .insert(locationUnits)
      .values({ communityId, structureId: structure.id, levelPosition: 1, name: 'Casa 1' })
      .returning();
    unitId = unit.id;

    const [accessPoint] = await db
      .insert(accessPoints)
      .values({ communityId, name: 'Puerta identidad' })
      .returning();

    const [residentPerson] = await db
      .insert(people)
      .values({ firstName: 'Resi', lastName: 'Dente' })
      .returning();
    const [residentUser] = await db
      .insert(users)
      .values({
        personId: residentPerson.id,
        name: 'Resi Dente',
        email: `residente-identidad-${suffix}@test.local`,
        passwordHash: 'x',
      })
      .returning();
    const [residentAccount] = await db
      .insert(accounts)
      .values({
        personId: residentPerson.id,
        name: 'Resi Dente',
        email: `residente-identidad-${suffix}@test.local`,
        passwordHash: 'x',
      })
      .returning();
    const [residentMembership] = await db
      .insert(memberships)
      .values({
        userId: residentUser.id,
        personId: residentPerson.id,
        name: 'Resi Dente',
        organizationId,
        communityId,
        role: 'owner',
        status: 'active',
        locationUnitId: unitId,
      })
      .returning();

    const [guardPerson] = await db
      .insert(people)
      .values({ firstName: 'Guar', lastName: 'Dia' })
      .returning();
    const [guardUser] = await db
      .insert(users)
      .values({
        personId: guardPerson.id,
        name: 'Guar Dia',
        email: `guardia-identidad-${suffix}@test.local`,
        passwordHash: 'x',
      })
      .returning();
    const [guardAccount] = await db
      .insert(accounts)
      .values({
        personId: guardPerson.id,
        name: 'Guar Dia',
        email: `guardia-identidad-${suffix}@test.local`,
        passwordHash: 'x',
      })
      .returning();
    const [guardMembership] = await db
      .insert(memberships)
      .values({
        userId: guardUser.id,
        personId: guardPerson.id,
        organizationId,
        communityId,
        role: 'guard',
        status: 'active',
      })
      .returning();

    residentToken = app.jwt.sign({
      sub: residentUser.id,
      accountId: residentAccount.id,
      personId: residentPerson.id,
      name: 'Resi Dente',
      role: 'owner',
      orgId: organizationId,
      communityId,
      membershipId: residentMembership.id,
      isPlatformAdmin: false,
    });

    guardToken = app.jwt.sign({
      sub: guardUser.id,
      accountId: guardAccount.id,
      personId: guardPerson.id,
      name: 'Guar Dia',
      role: 'guard',
      orgId: organizationId,
      communityId,
      membershipId: guardMembership.id,
      isPlatformAdmin: false,
    });

    const started = await request('POST', '/api/guard/shifts/start', guardToken, {
      accessPointId: accessPoint.id,
    });
    assert.equal(started.statusCode, 201, started.body);

    document = `ID-${suffix}`;
  });

  after(async () => {
    // The bitacora is append-only: it must go before the shift, or the foreign
    // key tries to null a column the trigger refuses to update.
    await db.delete(bitacoraEntries).where(eq(bitacoraEntries.communityId, communityId));

    // Segments block the cascade to the access points: clear the shift first.
    const shifts = await db
      .select({ id: guardShifts.id })
      .from(guardShifts)
      .where(eq(guardShifts.communityId, communityId));
    if (shifts.length > 0) {
      await db.delete(guardShiftSegments).where(
        inArray(
          guardShiftSegments.shiftId,
          shifts.map((shift) => shift.id),
        ),
      );
    }
    await db.delete(guardShifts).where(eq(guardShifts.communityId, communityId));
    await db.delete(organizations).where(eq(organizations.id, organizationId));
    await app.close();
  });

  it('counts a use per completed pair and consumes the pass at the limit', async () => {
    const created = await request('POST', '/api/passes', residentToken, {
      locationUnitId: unitId,
      visitorFirstName: 'Ana',
      visitorLastName: 'Pares',
      visitorDocument: document,
      type: 'entry_exit',
      maxUses: 2,
      validFrom: new Date(Date.now() - 60_000).toISOString(),
      validUntil: new Date(Date.now() + 3_600_000).toISOString(),
    });
    assert.equal(created.statusCode, 201, created.body);
    const passId = parse(created).pass.id as string;

    const found = await request(
      'GET',
      `/api/access/authorizations?document=${document}`,
      guardToken,
    );
    assert.equal(found.statusCode, 200, found.body);
    const candidates = parse(found) as unknown as Json[];
    assert.equal(candidates.length, 1);
    assert.equal(candidates[0].maxUses, 2);
    assert.equal(candidates[0].exitCount, 0);

    const entry = await request(
      'POST',
      `/api/access/authorizations/${passId}/confirm`,
      guardToken,
      { action: 'entry' },
    );
    assert.equal(entry.statusCode, 200, entry.body);

    let [row] = await db.select().from(accessPasses).where(eq(accessPasses.id, passId));
    assert.equal(row.entryCount, 1);
    assert.equal(row.exitCount, 0);
    assert.equal(row.presenceState, 'inside');
    assert.equal(row.status, 'active', 'entering does not consume the use');

    const exit = await request('POST', `/api/access/authorizations/${passId}/confirm`, guardToken, {
      action: 'exit',
    });
    assert.equal(exit.statusCode, 200, exit.body);

    [row] = await db.select().from(accessPasses).where(eq(accessPasses.id, passId));
    assert.equal(row.exitCount, 1);
    assert.equal(row.presenceState, 'outside', 'the visitor must be outside after leaving');
    assert.equal(row.status, 'active', 'one use of two still allows another entry');

    const secondEntry = await request(
      'POST',
      `/api/access/authorizations/${passId}/confirm`,
      guardToken,
      { action: 'entry' },
    );
    assert.equal(secondEntry.statusCode, 200, secondEntry.body);

    const secondExit = await request(
      'POST',
      `/api/access/authorizations/${passId}/confirm`,
      guardToken,
      { action: 'exit' },
    );
    assert.equal(secondExit.statusCode, 200, secondExit.body);

    [row] = await db.select().from(accessPasses).where(eq(accessPasses.id, passId));
    assert.equal(row.exitCount, 2);
    assert.equal(row.status, 'used', 'the pass is consumed at the second exit');

    const blocked = await request(
      'POST',
      `/api/access/authorizations/${passId}/confirm`,
      guardToken,
      { action: 'entry' },
    );
    assert.notEqual(blocked.statusCode, 200, 'a consumed pass cannot be used again');
  });

  it('refuses an entry for someone already inside', async () => {
    const created = await request('POST', '/api/passes', residentToken, {
      locationUnitId: unitId,
      visitorFirstName: 'Beto',
      visitorLastName: 'Adentro',
      visitorDocument: `${document}-B`,
      type: 'entry_exit',
      maxUses: 2,
      validFrom: new Date(Date.now() - 60_000).toISOString(),
      validUntil: new Date(Date.now() + 3_600_000).toISOString(),
    });
    const passId = parse(created).pass.id as string;

    await request('POST', `/api/access/authorizations/${passId}/confirm`, guardToken, {
      action: 'entry',
    });
    const again = await request(
      'POST',
      `/api/access/authorizations/${passId}/confirm`,
      guardToken,
      { action: 'entry' },
    );

    assert.equal(again.statusCode, 409, again.body);
  });

  it('forces a single use for entry-only passes', async () => {
    const created = await request('POST', '/api/passes', residentToken, {
      locationUnitId: unitId,
      visitorFirstName: 'Carla',
      visitorLastName: 'Una',
      visitorDocument: `${document}-C`,
      type: 'entry_only',
      maxUses: 5,
      validFrom: new Date(Date.now() - 60_000).toISOString(),
      validUntil: new Date(Date.now() + 3_600_000).toISOString(),
    });
    const passId = parse(created).pass.id as string;

    const [row] = await db.select().from(accessPasses).where(eq(accessPasses.id, passId));
    assert.equal(row.maxUses, 1);
  });
});
