import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { eq, inArray } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';

process.env.OUTBOX_WORKER_ENABLED = 'false';
process.env.DYNAMIC_QR_ENABLED = 'true';
process.env.PASS_QR_SECRET = 'integration-pass-secret';
process.env.PASS_WEB_URL = 'http://localhost:5176';

import { createDb } from '@porteria/database';
import {
  accessPasses,
  accessPoints,
  accounts,
  bitacoraEntries,
  communities,
  guardShifts,
  locationStructures,
  locationUnits,
  memberships,
  organizations,
  outboxEvents,
  passScans,
  people,
  users,
} from '@porteria/database/schema';
import { randomToken } from '../src/lib/pass-tokens.js';

const db = createDb();

let app: FastifyInstance;
let organizationId: string;
let communityId: string;
let otherCommunityId: string;
let accessPointId: string;
let otherAccessPointId: string;
let structureId: string;
let sectionId: string;
let floorId: string;
let leafAId: string;
let leafBId: string;
let residentPersonId: string;
let otherResidentPersonId: string;
let badResidentPersonId: string;
let guardPersonId: string;
let otherGuardPersonId: string;
let orgAdminPersonId: string;
let residentUserId: string;
let otherResidentUserId: string;
let badResidentUserId: string;
let guardUserId: string;
let otherGuardUserId: string;
let orgAdminUserId: string;
let residentAccountId: string;
let otherResidentAccountId: string;
let badResidentAccountId: string;
let guardAccountId: string;
let otherGuardAccountId: string;
let orgAdminAccountId: string;
let residentToken: string;
let otherResidentToken: string;
let badResidentToken: string;
let guardToken: string;
let otherGuardToken: string;
let orgAdminToken: string;

type Json = Record<string, any>;

function auth(token: string) {
  return { authorization: `Bearer ${token}` };
}

async function request(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  url: string,
  payload?: unknown,
  token?: string | null,
) {
  return app.inject({
    method,
    url,
    headers: token ? auth(token) : undefined,
    payload: payload as Record<string, unknown> | undefined,
  });
}

function parse(response: { body: string }) {
  return JSON.parse(response.body) as Json;
}

function extractCookie(response: { headers: Record<string, string | string[] | undefined> }) {
  const raw = response.headers['set-cookie'];
  const value = Array.isArray(raw) ? raw[0] : raw;
  assert.ok(value, 'expected a Set-Cookie header');
  return value.split(';')[0]!;
}

async function postPass(overrides: Json = {}, token = residentToken) {
  const now = Date.now();
  return request(
    'POST',
    '/api/passes',
    {
      locationUnitId: leafAId,
      visitorFirstName: 'Visitante',
      visitorLastName: 'Prueba',
      visitorDocument: '12345678',
      type: 'entry_only',
      validFrom: new Date(now - 60_000).toISOString(),
      validUntil: new Date(now + 3_600_000).toISOString(),
      ...overrides,
    },
    token,
  );
}

async function createPass(overrides: Json = {}, token = residentToken) {
  const response = await postPass(overrides, token);

  assert.equal(response.statusCode, 201, response.body);
  return parse(response) as {
    pass: { id: string; status: string; locationUnitId: string; type: string };
    shareUrl: string;
    qrToken: string;
    qrExpiresAt: string;
  };
}

function linkToken(pass: { shareUrl: string }) {
  return pass.shareUrl.split('/p/')[1]!;
}

async function bind(token: string) {
  const response = await request('POST', `/api/public/passes/${token}/bind`, {});
  assert.equal(response.statusCode, 200, response.body);
  return { cookie: extractCookie(response), body: parse(response) };
}

async function publicQr(token: string, cookie?: string) {
  return app.inject({
    method: 'GET',
    url: `/api/public/passes/${token}/qr`,
    headers: cookie ? { cookie } : undefined,
  });
}

async function scan(qrToken: string, token = guardToken) {
  return request('POST', '/api/access/scan', { token: qrToken }, token);
}

async function confirm(scanId: string, token = guardToken) {
  return request('POST', `/api/access/scans/${scanId}/confirm`, {}, token);
}

async function reject(scanId: string, reason = 'Documento ilegible', token = guardToken) {
  return request('POST', `/api/access/scans/${scanId}/reject`, { reason }, token);
}

describe('dynamic pass integration', () => {
  before(async () => {
    const suffix = randomUUID().slice(0, 8);

    const [organization] = await db
      .insert(organizations)
      .values({ name: `Pass Test Org ${suffix}`, slug: `pass-test-org-${suffix}` })
      .returning();
    organizationId = organization.id;

    const [community] = await db
      .insert(communities)
      .values({
        organizationId,
        name: `Pass Test Community ${suffix}`,
        slug: `pass-test-community-${suffix}`,
        address: 'Calle Pass 123',
        timezone: 'UTC',
      })
      .returning();
    communityId = community.id;

    const [otherCommunity] = await db
      .insert(communities)
      .values({
        organizationId,
        name: `Other Pass Community ${suffix}`,
        slug: `other-pass-community-${suffix}`,
        address: 'Calle Other 456',
        timezone: 'UTC',
      })
      .returning();
    otherCommunityId = otherCommunity.id;

    const [accessPoint] = await db
      .insert(accessPoints)
      .values({
        communityId,
        name: `Portón Principal ${suffix}`,
        type: 'gate',
        direction: 'both',
        active: true,
      })
      .returning();
    accessPointId = accessPoint.id;

    const [otherAccessPoint] = await db
      .insert(accessPoints)
      .values({
        communityId: otherCommunityId,
        name: `Portón Otro ${suffix}`,
        type: 'gate',
        direction: 'both',
        active: true,
      })
      .returning();
    otherAccessPointId = otherAccessPoint.id;

    const [structure] = await db
      .insert(locationStructures)
      .values({
        communityId,
        name: 'Pass Structure',
        levelCount: 3,
        level1Name: 'Section',
        level2Name: 'Floor',
        level3Name: 'Unit',
      })
      .returning();
    structureId = structure.id;

    const [section] = await db
      .insert(locationUnits)
      .values({
        communityId,
        structureId,
        parentId: null,
        levelPosition: 1,
        name: 'Pass Section',
        code: `PASS-SECTION-${suffix}`,
        sectionType: 'tower',
      })
      .returning();
    sectionId = section.id;

    const [floor] = await db
      .insert(locationUnits)
      .values({
        communityId,
        structureId,
        parentId: sectionId,
        levelPosition: 2,
        name: 'Pass Floor',
        code: `PASS-FLOOR-${suffix}`,
      })
      .returning();
    floorId = floor.id;

    const [leafA, leafB] = await db
      .insert(locationUnits)
      .values([
        {
          communityId,
          structureId,
          parentId: floorId,
          levelPosition: 3,
          name: 'Pass Unit A',
          code: `PASS-A-${suffix}`,
        },
        {
          communityId,
          structureId,
          parentId: floorId,
          levelPosition: 3,
          name: 'Pass Unit B',
          code: `PASS-B-${suffix}`,
        },
      ])
      .returning();
    leafAId = leafA.id;
    leafBId = leafB.id;

    const [residentPerson] = await db
      .insert(people)
      .values({ firstName: 'Residente', lastName: 'Principal', status: 'active' })
      .returning();
    residentPersonId = residentPerson.id;

    const [otherResidentPerson] = await db
      .insert(people)
      .values({ firstName: 'Residente', lastName: 'Otro', status: 'active' })
      .returning();
    otherResidentPersonId = otherResidentPerson.id;

    const [badResidentPerson] = await db
      .insert(people)
      .values({ firstName: 'Residente', lastName: 'No Hoja', status: 'active' })
      .returning();
    badResidentPersonId = badResidentPerson.id;

    const [guardPerson] = await db
      .insert(people)
      .values({ firstName: 'Guardia', lastName: 'Principal', status: 'active' })
      .returning();
    guardPersonId = guardPerson.id;

    const [otherGuardPerson] = await db
      .insert(people)
      .values({ firstName: 'Guardia', lastName: 'Otra Comunidad', status: 'active' })
      .returning();
    otherGuardPersonId = otherGuardPerson.id;

    const [orgAdminPerson] = await db
      .insert(people)
      .values({ firstName: 'Admin', lastName: 'Organizacion', status: 'active' })
      .returning();
    orgAdminPersonId = orgAdminPerson.id;

    const [residentUser] = await db
      .insert(users)
      .values({ email: `pass-resident-${suffix}@test.local`, passwordHash: 'x', name: 'Resident' })
      .returning();
    residentUserId = residentUser.id;

    const [otherResidentUser] = await db
      .insert(users)
      .values({
        email: `pass-other-resident-${suffix}@test.local`,
        passwordHash: 'x',
        name: 'Other Resident',
      })
      .returning();
    otherResidentUserId = otherResidentUser.id;

    const [badResidentUser] = await db
      .insert(users)
      .values({
        email: `pass-bad-resident-${suffix}@test.local`,
        passwordHash: 'x',
        name: 'Bad Resident',
      })
      .returning();
    badResidentUserId = badResidentUser.id;

    const [guardUser] = await db
      .insert(users)
      .values({ email: `pass-guard-${suffix}@test.local`, passwordHash: 'x', name: 'Guard' })
      .returning();
    guardUserId = guardUser.id;

    const [otherGuardUser] = await db
      .insert(users)
      .values({
        email: `pass-other-guard-${suffix}@test.local`,
        passwordHash: 'x',
        name: 'Other Guard',
      })
      .returning();
    otherGuardUserId = otherGuardUser.id;

    const [orgAdminUser] = await db
      .insert(users)
      .values({
        email: `pass-org-admin-${suffix}@test.local`,
        passwordHash: 'x',
        name: 'Org Admin',
      })
      .returning();
    orgAdminUserId = orgAdminUser.id;

    const [residentAccount] = await db
      .insert(accounts)
      .values({
        personId: residentPersonId,
        email: `pass-resident-${suffix}@test.local`,
        passwordHash: 'x',
      })
      .returning();
    residentAccountId = residentAccount.id;

    const [otherResidentAccount] = await db
      .insert(accounts)
      .values({
        personId: otherResidentPersonId,
        email: `pass-other-resident-${suffix}@test.local`,
        passwordHash: 'x',
      })
      .returning();
    otherResidentAccountId = otherResidentAccount.id;

    const [badResidentAccount] = await db
      .insert(accounts)
      .values({
        personId: badResidentPersonId,
        email: `pass-bad-resident-${suffix}@test.local`,
        passwordHash: 'x',
      })
      .returning();
    badResidentAccountId = badResidentAccount.id;

    const [guardAccount] = await db
      .insert(accounts)
      .values({
        personId: guardPersonId,
        email: `pass-guard-${suffix}@test.local`,
        passwordHash: 'x',
      })
      .returning();
    guardAccountId = guardAccount.id;

    const [otherGuardAccount] = await db
      .insert(accounts)
      .values({
        personId: otherGuardPersonId,
        email: `pass-other-guard-${suffix}@test.local`,
        passwordHash: 'x',
      })
      .returning();
    otherGuardAccountId = otherGuardAccount.id;

    const [orgAdminAccount] = await db
      .insert(accounts)
      .values({
        personId: orgAdminPersonId,
        email: `pass-org-admin-${suffix}@test.local`,
        passwordHash: 'x',
      })
      .returning();
    orgAdminAccountId = orgAdminAccount.id;

    const [residentMembership] = await db
      .insert(memberships)
      .values({
        userId: residentUserId,
        personId: residentPersonId,
        organizationId,
        communityId,
        locationUnitId: leafAId,
        role: 'owner',
        status: 'active',
      })
      .returning();

    const [otherResidentMembership] = await db
      .insert(memberships)
      .values({
        userId: otherResidentUserId,
        personId: otherResidentPersonId,
        organizationId,
        communityId,
        locationUnitId: leafBId,
        role: 'resident',
        status: 'active',
      })
      .returning();

    const [badResidentMembership] = await db
      .insert(memberships)
      .values({
        userId: badResidentUserId,
        personId: badResidentPersonId,
        organizationId,
        communityId,
        locationUnitId: floorId,
        role: 'resident',
        status: 'active',
      })
      .returning();

    const [guardMembership] = await db
      .insert(memberships)
      .values({
        userId: guardUserId,
        personId: guardPersonId,
        organizationId,
        communityId,
        locationUnitId: null,
        defaultAccessPointId: accessPointId,
        role: 'guard',
        status: 'active',
      })
      .returning();

    const [otherGuardMembership] = await db
      .insert(memberships)
      .values({
        userId: otherGuardUserId,
        personId: otherGuardPersonId,
        organizationId,
        communityId: otherCommunityId,
        locationUnitId: null,
        role: 'guard',
        status: 'active',
      })
      .returning();

    const [orgAdminMembership] = await db
      .insert(memberships)
      .values({
        userId: orgAdminUserId,
        personId: orgAdminPersonId,
        organizationId,
        communityId: null,
        locationUnitId: null,
        role: 'org_admin',
        status: 'active',
      })
      .returning();

    const { buildApp } = await import('../src/index.js');
    app = (await buildApp()).app;

    const base = {
      email: `user-${suffix}@test.local`,
      orgId: organizationId,
      unitId: null,
      isPlatformAdmin: false,
    };

    residentToken = app.jwt.sign({
      ...base,
      sub: residentUserId,
      accountId: residentAccountId,
      personId: residentPersonId,
      membershipId: residentMembership.id,
      role: 'owner',
      communityId,
    });
    otherResidentToken = app.jwt.sign({
      ...base,
      sub: otherResidentUserId,
      accountId: otherResidentAccountId,
      personId: otherResidentPersonId,
      membershipId: otherResidentMembership.id,
      role: 'resident',
      communityId,
    });
    badResidentToken = app.jwt.sign({
      ...base,
      sub: badResidentUserId,
      accountId: badResidentAccountId,
      personId: badResidentPersonId,
      membershipId: badResidentMembership.id,
      role: 'resident',
      communityId,
    });
    guardToken = app.jwt.sign({
      ...base,
      sub: guardUserId,
      accountId: guardAccountId,
      personId: guardPersonId,
      membershipId: guardMembership.id,
      role: 'guard',
      communityId,
    });
    otherGuardToken = app.jwt.sign({
      ...base,
      sub: otherGuardUserId,
      accountId: otherGuardAccountId,
      personId: otherGuardPersonId,
      membershipId: otherGuardMembership.id,
      role: 'guard',
      communityId: otherCommunityId,
    });
    orgAdminToken = app.jwt.sign({
      ...base,
      sub: orgAdminUserId,
      accountId: orgAdminAccountId,
      personId: orgAdminPersonId,
      membershipId: orgAdminMembership.id,
      role: 'org_admin',
      communityId: null,
    });

    const guardShiftStart = await request('POST', '/api/guard/shifts/start', {}, guardToken);
    assert.equal(guardShiftStart.statusCode, 201, guardShiftStart.body);

    const otherGuardShiftStart = await request(
      'POST',
      '/api/guard/shifts/start',
      { accessPointId: otherAccessPointId },
      otherGuardToken,
    );
    assert.equal(otherGuardShiftStart.statusCode, 201, otherGuardShiftStart.body);
  });

  after(async () => {
    await db
      .delete(bitacoraEntries)
      .where(inArray(bitacoraEntries.communityId, [communityId, otherCommunityId]));
    await db
      .delete(guardShifts)
      .where(inArray(guardShifts.communityId, [communityId, otherCommunityId]));
    await db
      .delete(passScans)
      .where(inArray(passScans.communityId, [communityId, otherCommunityId]));
    await db
      .delete(accessPasses)
      .where(inArray(accessPasses.communityId, [communityId, otherCommunityId]));
    await db
      .delete(accessPoints)
      .where(inArray(accessPoints.communityId, [communityId, otherCommunityId]));
    await db.delete(outboxEvents).where(eq(outboxEvents.organizationId, organizationId));
    await db.delete(memberships).where(eq(memberships.organizationId, organizationId));
    await db
      .delete(users)
      .where(
        inArray(users.id, [
          residentUserId,
          otherResidentUserId,
          badResidentUserId,
          guardUserId,
          otherGuardUserId,
          orgAdminUserId,
        ]),
      );
    await db
      .delete(people)
      .where(
        inArray(people.id, [
          residentPersonId,
          otherResidentPersonId,
          badResidentPersonId,
          guardPersonId,
          otherGuardPersonId,
          orgAdminPersonId,
        ]),
      );
    await db.delete(organizations).where(eq(organizations.id, organizationId));
    await app.close();
  });

  it('creates, lists and returns a pass with its location path', async () => {
    const created = await createPass();
    const token = linkToken(created);

    assert.match(created.shareUrl, /\/p\/[a-f0-9]{64}$/);
    assert.equal(created.pass.status, 'active');
    assert.equal(created.pass.locationUnitId, leafAId);
    assert.ok(created.qrToken);

    const list = await request('GET', '/api/passes', undefined, residentToken);
    assert.equal(list.statusCode, 200);
    const listed = parse(list) as Json[];
    assert.equal(
      listed.some((row) => row.id === created.pass.id),
      true,
    );

    const detail = await request('GET', `/api/passes/${created.pass.id}`, undefined, residentToken);
    assert.equal(detail.statusCode, 200);
    const detailBody = parse(detail);
    assert.equal(detailBody.id, created.pass.id);
    assert.match(String(detailBody.locationPath), /Pass Unit A$/);

    const preview = await request('GET', `/api/public/passes/${token}`);
    assert.equal(preview.statusCode, 200);
    const previewBody = parse(preview);
    assert.match(String(previewBody.communityName), /^Pass Test Community /);
  });

  it('rejects non-leaf units, foreign units and reserved pass options', async () => {
    const nonLeaf = await postPass({ locationUnitId: floorId }, badResidentToken);
    assert.equal(nonLeaf.statusCode, 400, nonLeaf.body);
    assert.equal(parse(nonLeaf).message, 'invalid');

    const foreignUnit = await postPass({ locationUnitId: leafBId }, residentToken);
    assert.equal(foreignUnit.statusCode, 403, foreignUnit.body);
    assert.equal(parse(foreignUnit).message, 'forbidden');

    const recurring = await postPass({ type: 'entry_exit_recurring' });
    assert.equal(recurring.statusCode, 400, recurring.body);
    assert.equal(parse(recurring).message, 'recurring_not_available');

    const allowedDays = await postPass({ allowedDays: [1] });
    assert.equal(allowedDays.statusCode, 400, allowedDays.body);
    assert.equal(parse(allowedDays).message, 'allowed_days_reserved');

    const vehicleWithoutPlate = await postPass({ hasVehicle: true });
    assert.equal(vehicleWithoutPlate.statusCode, 400, vehicleWithoutPlate.body);
    assert.equal(parse(vehicleWithoutPlate).message, 'invalid');

    const incompleteWindow = await postPass({ timeFrom: '08:00' });
    assert.equal(incompleteWindow.statusCode, 400, incompleteWindow.body);
    assert.equal(parse(incompleteWindow).message, 'invalid');

    const now = Date.now();
    const invertedRange = await postPass({
      validFrom: new Date(now + 2 * 3_600_000).toISOString(),
      validUntil: new Date(now + 3_600_000).toISOString(),
    });
    assert.equal(invertedRange.statusCode, 400, invertedRange.body);
    assert.equal(parse(invertedRange).message, 'invalid');
  });

  it('exposes a masked preview and binds only the first device', async () => {
    const created = await createPass();
    const token = linkToken(created);

    const preview = await request('GET', `/api/public/passes/${token}`);
    assert.equal(preview.statusCode, 200);
    const previewBody = parse(preview);
    assert.equal(previewBody.visitorFirstName, 'Visitante');
    assert.equal(previewBody.maskedDocument, '***5678');
    assert.match(String(previewBody.locationPath), /Pass Section \/ Pass Floor \/ Pass Unit A$/);
    assert.equal(previewBody.pinRequired, false);

    const first = await bind(token);
    assert.equal(first.body.alreadyBound, false);

    const secondDevice = await request('POST', `/api/public/passes/${token}/bind`, {});
    assert.equal(secondDevice.statusCode, 403);
    assert.equal(parse(secondDevice).message, 'device_already_bound');

    const sameDevice = await request('POST', `/api/public/passes/${token}/bind`, {}, undefined);
    assert.equal(sameDevice.statusCode, 403);

    const idempotent = await app.inject({
      method: 'POST',
      url: `/api/public/passes/${token}/bind`,
      headers: { cookie: first.cookie },
      payload: {},
    });
    assert.equal(idempotent.statusCode, 200);
    assert.equal(parse(idempotent).alreadyBound, true);
  });

  it('returns rotating QR tokens and rejects unbound devices', async () => {
    const created = await createPass();
    const token = linkToken(created);
    const { cookie } = await bind(token);

    const unbound = await publicQr(token);
    assert.equal(unbound.statusCode, 403);
    assert.equal(parse(unbound).message, 'not_bound');

    const first = await publicQr(token, cookie);
    const second = await publicQr(token, cookie);
    assert.equal(first.statusCode, 200);
    assert.equal(second.statusCode, 200);

    const firstToken = parse(first).token as string;
    const secondToken = parse(second).token as string;
    assert.notEqual(firstToken, secondToken);

    const firstPayload = JSON.parse(
      Buffer.from(firstToken.split('.')[1]!, 'base64url').toString('utf8'),
    ) as { passId: string; jti: string; iat: number; exp: number; v: number };
    assert.equal(firstPayload.passId, created.pass.id);
    assert.equal(firstPayload.v, 1);
    assert.ok(firstPayload.jti);
    assert.equal(firstPayload.exp - firstPayload.iat, 24);
  });

  it('revokes a pass and rejects a second revocation', async () => {
    const created = await createPass();
    const token = linkToken(created);

    const revoked = await request(
      'POST',
      `/api/passes/${created.pass.id}/revoke`,
      {},
      residentToken,
    );
    assert.equal(revoked.statusCode, 200);
    assert.equal(parse(revoked).status, 'revoked');

    const second = await request(
      'POST',
      `/api/passes/${created.pass.id}/revoke`,
      {},
      residentToken,
    );
    assert.equal(second.statusCode, 409);
    assert.equal(parse(second).message, 'conflict');

    const preview = await request('GET', `/api/public/passes/${token}`);
    assert.equal(preview.statusCode, 410);
    assert.equal(parse(preview).message, 'gone');
  });

  it('regenerates the link and invalidates the previous token', async () => {
    const created = await createPass();
    const oldToken = linkToken(created);

    const regenerated = await request(
      'POST',
      `/api/passes/${created.pass.id}/regenerate-link`,
      {},
      residentToken,
    );
    assert.equal(regenerated.statusCode, 200);
    const newShareUrl = parse(regenerated).shareUrl as string;
    const newToken = newShareUrl.split('/p/')[1]!;
    assert.notEqual(newToken, oldToken);

    const oldPreview = await request('GET', `/api/public/passes/${oldToken}`);
    assert.equal(oldPreview.statusCode, 404);
    assert.equal(parse(oldPreview).message, 'not_found');

    const newPreview = await request('GET', `/api/public/passes/${newToken}`);
    assert.equal(newPreview.statusCode, 200);
  });

  it('rejects expired links', async () => {
    const created = await createPass();
    const token = linkToken(created);

    await db
      .update(accessPasses)
      .set({ linkExpiresAt: new Date(Date.now() - 1_000) })
      .where(eq(accessPasses.id, created.pass.id));

    const preview = await request('GET', `/api/public/passes/${token}`);
    assert.equal(preview.statusCode, 410);
    assert.equal(parse(preview).message, 'link_expired');

    const bindAttempt = await request('POST', `/api/public/passes/${token}/bind`, {});
    assert.equal(bindAttempt.statusCode, 410);
    assert.equal(parse(bindAttempt).message, 'link_expired');
  });

  it('enforces the PIN lockout and resets it on success', async () => {
    const created = await createPass({ pin: '1234' });
    const token = linkToken(created);

    const preview = await request('GET', `/api/public/passes/${token}`);
    assert.equal(preview.statusCode, 200);
    assert.equal(parse(preview).pinRequired, true);

    const withoutPin = await request('POST', `/api/public/passes/${token}/bind`, {});
    assert.equal(withoutPin.statusCode, 403);
    assert.equal(parse(withoutPin).message, 'invalid_pin');

    for (let attempt = 1; attempt <= 4; attempt += 1) {
      const wrong = await request('POST', `/api/public/passes/${token}/bind`, { pin: '0000' });
      assert.equal(wrong.statusCode, 403, `attempt ${attempt}`);
      assert.equal(parse(wrong).message, 'invalid_pin');
    }

    const locked = await request('POST', `/api/public/passes/${token}/bind`, { pin: '0000' });
    assert.equal(locked.statusCode, 429);
    assert.equal(parse(locked).message, 'pin_locked');

    const correctWhileLocked = await request('POST', `/api/public/passes/${token}/bind`, {
      pin: '1234',
    });
    assert.equal(correctWhileLocked.statusCode, 429);

    await db
      .update(accessPasses)
      .set({ pinFailedAttempts: 0, pinLockedUntil: null })
      .where(eq(accessPasses.id, created.pass.id));

    const correct = await request('POST', `/api/public/passes/${token}/bind`, { pin: '1234' });
    assert.equal(correct.statusCode, 200);
    assert.equal(parse(correct).alreadyBound, false);

    const secondDevice = await request('POST', `/api/public/passes/${token}/bind`, {
      pin: '1234',
    });
    assert.equal(secondDevice.statusCode, 403);
    assert.equal(parse(secondDevice).message, 'device_already_bound');
  });

  it('confirms an entry and an exit for an entry_exit pass', async () => {
    const created = await createPass({ type: 'entry_exit' });
    const token = linkToken(created);
    const { cookie } = await bind(token);

    const entryQr = parse(await publicQr(token, cookie)).token as string;
    const entryScan = await scan(entryQr);
    assert.equal(entryScan.statusCode, 200);
    const entryBody = parse(entryScan);
    assert.equal(entryBody.authorized, true);
    assert.equal(entryBody.action, 'entry');
    assert.equal(entryBody.status, 'pending');
    assert.ok(entryBody.scanId);

    const entryConfirm = await confirm(entryBody.scanId as string);
    assert.equal(entryConfirm.statusCode, 200);
    const entryConfirmBody = parse(entryConfirm);
    assert.equal(entryConfirmBody.scanId, entryBody.scanId);
    assert.equal(entryConfirmBody.status, 'confirmed');
    assert.equal(entryConfirmBody.action, 'entry');
    assert.equal(entryConfirmBody.passStatus, 'active');
    assert.equal(entryConfirmBody.presenceState, 'inside');
    assert.ok(entryConfirmBody.bitacoraEntryId);

    const entryBitacora = await request(
      'GET',
      `/api/bitacora/${entryConfirmBody.bitacoraEntryId}`,
      undefined,
      guardToken,
    );
    assert.equal(entryBitacora.statusCode, 200);
    const entryBitacoraBody = parse(entryBitacora);
    assert.equal(entryBitacoraBody.destinationLocationUnitId, created.pass.locationUnitId);
    assert.equal(entryBitacoraBody.authorizedByPersonId, created.pass.authorizedByPersonId);
    assert.ok(entryBitacoraBody.destinationPath);
    assert.ok(entryBitacoraBody.authorizedByName);

    const replay = await scan(entryQr);
    assert.equal(replay.statusCode, 409);
    assert.equal(parse(replay).message, 'token_already_used');

    const exitQr = parse(await publicQr(token, cookie)).token as string;
    const exitScan = await scan(exitQr);
    assert.equal(exitScan.statusCode, 200);
    const exitBody = parse(exitScan);
    assert.equal(exitBody.action, 'exit');
    assert.equal(exitBody.authorized, true);

    const exitConfirm = await confirm(exitBody.scanId as string);
    assert.equal(exitConfirm.statusCode, 200);
    const exitConfirmBody = parse(exitConfirm);
    assert.equal(exitConfirmBody.scanId, exitBody.scanId);
    assert.equal(exitConfirmBody.status, 'confirmed');
    assert.equal(exitConfirmBody.action, 'exit');
    assert.equal(exitConfirmBody.passStatus, 'used');
    assert.equal(exitConfirmBody.presenceState, 'outside');
    assert.ok(exitConfirmBody.bitacoraEntryId);

    const usedScan = await scan(exitQr);
    assert.equal(usedScan.statusCode, 200);
    const usedBody = parse(usedScan);
    assert.equal(usedBody.authorized, false);
    assert.equal(usedBody.reason, 'pass_used');
    assert.equal(usedBody.scanId, null);
    assert.ok(usedBody.bitacoraEntryId);

    const deniedBitacora = await request(
      'GET',
      `/api/bitacora/${usedBody.bitacoraEntryId as string}`,
      undefined,
      guardToken,
    );
    assert.equal(deniedBitacora.statusCode, 200);
    const deniedBitacoraBody = parse(deniedBitacora);
    assert.ok(deniedBitacoraBody.destinationPath);
    assert.ok(deniedBitacoraBody.authorizedByName);
  });

  it('marks an entry_only pass as used and denies a second scan', async () => {
    const created = await createPass({ type: 'entry_only' });
    const token = linkToken(created);
    const { cookie } = await bind(token);
    const qr = parse(await publicQr(token, cookie)).token as string;

    const scanned = await scan(qr);
    assert.equal(scanned.statusCode, 200);
    const scannedBody = parse(scanned);

    const confirmed = await confirm(scannedBody.scanId as string);
    assert.equal(confirmed.statusCode, 200);
    const confirmedBody = parse(confirmed);
    assert.equal(confirmedBody.scanId, scannedBody.scanId);
    assert.equal(confirmedBody.status, 'confirmed');
    assert.equal(confirmedBody.action, 'entry');
    assert.equal(confirmedBody.passStatus, 'used');
    assert.equal(confirmedBody.presenceState, 'inside');
    assert.ok(confirmedBody.bitacoraEntryId);

    const residentQr = await request(
      'GET',
      `/api/passes/${created.pass.id}/qr`,
      undefined,
      residentToken,
    );
    assert.equal(residentQr.statusCode, 410);
    assert.equal(parse(residentQr).message, 'pass_used');

    const secondScan = await scan(qr);
    assert.equal(secondScan.statusCode, 200);
    assert.equal(parse(secondScan).reason, 'pass_used');
    assert.equal(parse(secondScan).scanId, null);
  });

  it('rejects a pending scan without changing the pass', async () => {
    const created = await createPass({ type: 'entry_exit' });
    const token = linkToken(created);
    const { cookie } = await bind(token);
    const qr = parse(await publicQr(token, cookie)).token as string;
    const scanned = parse(await scan(qr));

    const rejected = await reject(scanned.scanId as string);
    assert.equal(rejected.statusCode, 200);
    const rejectedBody = parse(rejected);
    assert.equal(rejectedBody.scanId, scanned.scanId);
    assert.equal(rejectedBody.status, 'rejected');
    assert.equal(rejectedBody.action, 'entry');
    assert.equal(rejectedBody.passStatus, 'active');
    assert.equal(rejectedBody.presenceState, 'outside');
    assert.ok(rejectedBody.bitacoraEntryId);

    const rejectedBitacora = await request(
      'GET',
      `/api/bitacora/${rejectedBody.bitacoraEntryId}`,
      undefined,
      guardToken,
    );
    assert.equal(rejectedBitacora.statusCode, 200);
    assert.ok(parse(rejectedBitacora).authorizedByName);

    const confirmRejected = await confirm(scanned.scanId as string);
    assert.equal(confirmRejected.statusCode, 409);
    assert.equal(parse(confirmRejected).message, 'scan_already_processed');

    const status = await app.inject({
      method: 'GET',
      url: `/api/public/passes/${token}/status`,
      headers: { cookie },
    });
    assert.equal(status.statusCode, 200);
    assert.equal(parse(status).status, 'active');
    assert.equal(parse(status).presenceState, 'outside');
  });

  it('expires a pending scan after the configured TTL', async () => {
    const created = await createPass({ type: 'entry_exit' });
    const token = linkToken(created);
    const { cookie } = await bind(token);
    const qr = parse(await publicQr(token, cookie)).token as string;
    const scanned = parse(await scan(qr));

    await db
      .update(passScans)
      .set({ scannedAt: new Date(Date.now() - 3 * 60_000) })
      .where(eq(passScans.id, scanned.scanId as string));

    const expired = await confirm(scanned.scanId as string);
    assert.equal(expired.statusCode, 409);
    assert.equal(parse(expired).message, 'scan_expired');

    const [row] = await db
      .select({ status: passScans.status })
      .from(passScans)
      .where(eq(passScans.id, scanned.scanId as string));
    assert.equal(row?.status, 'expired');
  });

  it('denies out-of-schedule scans without creating a pending scan', async () => {
    const now = Date.now();
    const created = await createPass({
      validFrom: new Date(now + 3_600_000).toISOString(),
      validUntil: new Date(now + 7_200_000).toISOString(),
    });
    const token = linkToken(created);
    const { cookie } = await bind(token);

    const qrResponse = await publicQr(token, cookie);
    assert.equal(qrResponse.statusCode, 409);
    assert.equal(parse(qrResponse).message, 'not_valid_now');

    const denied = await scan(created.qrToken);
    assert.equal(denied.statusCode, 200);
    const body = parse(denied);
    assert.equal(body.authorized, false);
    assert.equal(body.reason, 'out_of_schedule');
    assert.equal(body.scanId, null);
  });

  it('rejects a guard from another community', async () => {
    const created = await createPass();
    const denied = await scan(created.qrToken, otherGuardToken);

    assert.equal(denied.statusCode, 403);
    assert.equal(parse(denied).message, 'foreign_community');
  });

  it('lists the guard scan history with location paths', async () => {
    const history = await request('GET', '/api/access/scans?pageSize=100', undefined, guardToken);
    assert.equal(history.statusCode, 200);
    const body = parse(history) as { items: Json[]; total: number; page: number; pageSize: number };

    assert.ok(body.items.length > 0);
    assert.ok(body.total >= body.items.length);
    assert.equal(body.page, 1);
    assert.equal(body.pageSize, 100);
    assert.match(String(body.items[0]?.locationPath), /Pass Unit A/);
  });

  it('rejects pass creation after the per-unit daily limit', async () => {
    const now = Date.now();
    await db.insert(accessPasses).values(
      Array.from({ length: 20 }, () => ({
        communityId,
        locationUnitId: leafBId,
        structureId,
        createdByPersonId: otherResidentPersonId,
        authorizedByPersonId: otherResidentPersonId,
        visitorFirstName: 'Limite',
        visitorLastName: 'Diario',
        visitorDocument: randomUUID().slice(0, 8),
        type: 'entry_only' as const,
        validFrom: new Date(now - 60_000),
        validUntil: new Date(now + 3_600_000),
        linkTokenHash: randomToken(32),
        linkExpiresAt: new Date(now + 3_600_000),
      })),
    );

    const blocked = await postPass({ locationUnitId: leafBId }, otherResidentToken);
    assert.equal(blocked.statusCode, 429, blocked.body);
    assert.equal(parse(blocked).message, 'daily_limit_reached');
  });

  it('rate-limits public preview requests per token', async () => {
    const created = await createPass();
    const token = linkToken(created);

    for (let attempt = 0; attempt < 60; attempt += 1) {
      const response = await request('GET', `/api/public/passes/${token}`);
      assert.equal(response.statusCode, 200, `attempt ${attempt}`);
    }

    const limited = await request('GET', `/api/public/passes/${token}`);
    assert.equal(limited.statusCode, 429);
    assert.equal(parse(limited).message, 'rate_limited');
  });

  it('does not persist raw link or QR tokens in outbox events', async () => {
    const created = await createPass();
    const token = linkToken(created);

    const events = await db
      .select({
        eventType: outboxEvents.eventType,
        payload: outboxEvents.payload,
        envelope: outboxEvents.envelope,
      })
      .from(outboxEvents)
      .where(eq(outboxEvents.organizationId, organizationId));

    assert.ok(events.length > 0);
    for (const event of events) {
      const serialized = `${JSON.stringify(event.payload)} ${JSON.stringify(event.envelope)}`;
      assert.equal(serialized.includes(token), false, event.eventType);
      assert.equal(serialized.includes(created.qrToken), false, event.eventType);
      assert.equal(serialized.includes('linkToken'), false, event.eventType);
      assert.equal(serialized.includes('qrToken'), false, event.eventType);
    }
  });
});
