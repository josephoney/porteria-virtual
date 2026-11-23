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
} from '@porteria/database/schema';
import { randomToken } from '../src/lib/pass-tokens.js';
import { passTicketState, PERMANENT_PASS_UNTIL } from '@porteria/shared';

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

function extractCookies(response: {
  headers: Record<string, string | string[] | undefined>;
}): Record<string, string> {
  const raw = response.headers['set-cookie'];
  const values = Array.isArray(raw) ? raw : raw ? [raw] : [];
  assert.ok(values.length > 0, 'expected Set-Cookie headers');

  const cookies: Record<string, string> = {};
  for (const value of values) {
    const pair = value.split(';')[0]!;
    const index = pair.indexOf('=');
    cookies[pair.slice(0, index)] = pair.slice(index + 1);
  }
  return cookies;
}

function cookieHeader(cookies: Record<string, string>): string {
  return Object.entries(cookies)
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');
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

async function bindCookies(token: string) {
  const response = await request('POST', `/api/public/passes/${token}/bind`, {});
  assert.equal(response.statusCode, 200, response.body);
  return { cookies: extractCookies(response), body: parse(response) };
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

/** One complete entry + exit pair, asserting that both scans are authorized. */
async function completeCycle(token: string, cookie: string) {
  const entryQr = parse(await publicQr(token, cookie)).token as string;
  const entryScan = await scan(entryQr);
  assert.equal(entryScan.statusCode, 200, entryScan.body);
  const entry = parse(entryScan);
  assert.equal(entry.authorized, true, entryScan.body);
  const entryConfirm = await confirm(entry.scanId as string);
  assert.equal(entryConfirm.statusCode, 200, entryConfirm.body);

  const exitQr = parse(await publicQr(token, cookie)).token as string;
  const exitScan = await scan(exitQr);
  assert.equal(exitScan.statusCode, 200, exitScan.body);
  const exit = parse(exitScan);
  assert.equal(exit.authorized, true, exitScan.body);
  const exitConfirm = await confirm(exit.scanId as string);
  assert.equal(exitConfirm.statusCode, 200, exitConfirm.body);

  return { entry: parse(entryConfirm), exit: parse(exitConfirm) };
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
        // The suite creates passes in almost every test. Each limit test states
        // the rule it needs instead of depending on the accumulated count.
        passDailyLimitEnabled: false,
        passDailyLimit: 20,
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
      sub: residentAccountId,
      accountId: residentAccountId,
      personId: residentPersonId,
      membershipId: residentMembership.id,
      role: 'owner',
      communityId,
    });
    otherResidentToken = app.jwt.sign({
      ...base,
      sub: otherResidentAccountId,
      accountId: otherResidentAccountId,
      personId: otherResidentPersonId,
      membershipId: otherResidentMembership.id,
      role: 'resident',
      communityId,
    });
    badResidentToken = app.jwt.sign({
      ...base,
      sub: badResidentAccountId,
      accountId: badResidentAccountId,
      personId: badResidentPersonId,
      membershipId: badResidentMembership.id,
      role: 'resident',
      communityId,
    });
    guardToken = app.jwt.sign({
      ...base,
      sub: guardAccountId,
      accountId: guardAccountId,
      personId: guardPersonId,
      membershipId: guardMembership.id,
      role: 'guard',
      communityId,
    });
    otherGuardToken = app.jwt.sign({
      ...base,
      sub: otherGuardAccountId,
      accountId: otherGuardAccountId,
      personId: otherGuardPersonId,
      membershipId: otherGuardMembership.id,
      role: 'guard',
      communityId: otherCommunityId,
    });
    orgAdminToken = app.jwt.sign({
      ...base,
      sub: orgAdminAccountId,
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

  it('stores companions and exposes only their count in the public preview', async () => {
    const companions = [
      { firstName: '  Ana ', lastName: ' Pérez ', document: ' COMP-A1 ' },
      { firstName: 'Luis', lastName: 'Gómez', document: 'COMP-A2' },
    ];
    const created = await createPass({
      visitorDocument: 'COMP-1001',
      companions,
    });

    const detail = await request('GET', `/api/passes/${created.pass.id}`, undefined, residentToken);
    assert.equal(detail.statusCode, 200, detail.body);
    const detailBody = parse(detail);
    assert.deepEqual(detailBody.companions, [
      { firstName: 'Ana', lastName: 'Pérez', document: 'COMP-A1' },
      { firstName: 'Luis', lastName: 'Gómez', document: 'COMP-A2' },
    ]);

    const list = await request('GET', '/api/passes', undefined, residentToken);
    assert.equal(list.statusCode, 200, list.body);
    const listed = (parse(list) as Json[]).find((row) => row.id === created.pass.id);
    assert.ok(listed, 'the created pass must be listed');
    assert.deepEqual(listed.companions, detailBody.companions);

    const preview = await request('GET', `/api/public/passes/${linkToken(created)}`);
    assert.equal(preview.statusCode, 200, preview.body);
    const previewBody = parse(preview);
    assert.equal(previewBody.companionCount, 2);
    // Names and documents must never reach the shared link.
    assert.equal(previewBody.companions, undefined);
  });

  it('creates a pass without companions as an empty list', async () => {
    const created = await createPass({ visitorDocument: 'COMP-1002' });

    const detail = await request('GET', `/api/passes/${created.pass.id}`, undefined, residentToken);
    assert.equal(detail.statusCode, 200, detail.body);
    assert.deepEqual(parse(detail).companions, []);

    const preview = await request('GET', `/api/public/passes/${linkToken(created)}`);
    assert.equal(parse(preview).companionCount, 0);
  });

  it('rejects incomplete, duplicated and oversized companion lists', async () => {
    const incomplete = await postPass({
      companions: [{ firstName: 'Ana', lastName: 'Pérez' }],
    });
    assert.equal(incomplete.statusCode, 400, incomplete.body);
    assert.equal(parse(incomplete).message, 'Validation error');

    const duplicated = await postPass({
      companions: [
        { firstName: 'Ana', lastName: 'Pérez', document: 'DUP-1' },
        { firstName: 'Luis', lastName: 'Gómez', document: 'dup-1' },
      ],
    });
    assert.equal(duplicated.statusCode, 400, duplicated.body);
    assert.ok(
      (parse(duplicated).details as Json[]).some(
        (issue) => issue.message === 'duplicate_companion_document',
      ),
    );

    const tooMany = await postPass({
      companions: Array.from({ length: 11 }, (_, index) => ({
        firstName: `Acompañante ${index}`,
        lastName: 'Prueba',
        document: `MAX-${index}`,
      })),
    });
    assert.equal(tooMany.statusCode, 400, tooMany.body);
    assert.ok(
      (parse(tooMany).details as Json[]).some((issue) => issue.message === 'max_companions'),
    );
  });

  it('rejects non-leaf and foreign units and accepts schedule options', async () => {
    const nonLeaf = await postPass({ locationUnitId: floorId }, badResidentToken);
    assert.equal(nonLeaf.statusCode, 400, nonLeaf.body);
    assert.equal(parse(nonLeaf).message, 'invalid');

    const foreignUnit = await postPass({ locationUnitId: leafBId }, residentToken);
    assert.equal(foreignUnit.statusCode, 403, foreignUnit.body);
    assert.equal(parse(foreignUnit).message, 'forbidden');

    const recurring = await postPass({ type: 'entry_exit_recurring' });
    assert.equal(recurring.statusCode, 400, recurring.body);
    assert.equal(parse(recurring).message, 'recurring_not_available');

    const weekly = await postPass({ recurrence: 'weekly', allowedDays: [3, 1, 3] });
    assert.equal(weekly.statusCode, 201, weekly.body);
    assert.deepEqual(parse(weekly).pass.allowedDays, [1, 3]);

    const weeklyWithoutDays = await postPass({ recurrence: 'weekly' });
    assert.equal(weeklyWithoutDays.statusCode, 400, weeklyWithoutDays.body);
    assert.equal(parse(weeklyWithoutDays).message, 'Validation error');
    assert.deepEqual(parse(weeklyWithoutDays).details, [
      { path: 'allowedDays', message: 'weekly_requires_days' },
    ]);

    const daysOnOnce = await postPass({ allowedDays: [1] });
    assert.equal(daysOnOnce.statusCode, 400, daysOnOnce.body);
    assert.deepEqual(parse(daysOnOnce).details, [
      { path: 'allowedDays', message: 'allowed_days_only_for_weekly' },
    ]);

    const daysOnRange = await postPass({ recurrence: 'range', allowedDays: [1] });
    assert.equal(daysOnRange.statusCode, 400, daysOnRange.body);

    const vehicleWithoutPlate = await postPass({ hasVehicle: true });
    assert.equal(vehicleWithoutPlate.statusCode, 400, vehicleWithoutPlate.body);
    assert.equal(parse(vehicleWithoutPlate).message, 'invalid');

    const incompleteWindow = await postPass({ timeFrom: '08:00' });
    assert.equal(incompleteWindow.statusCode, 400, incompleteWindow.body);
    assert.equal(parse(incompleteWindow).message, 'invalid');

    // Same minute expressed with and without seconds. A raw string comparison
    // would accept this as a valid window, so compare clock minutes instead.
    const zeroWidthWindow = await postPass({ timeFrom: '08:00', timeTo: '08:00:00' });
    assert.equal(zeroWidthWindow.statusCode, 400, zeroWidthWindow.body);
    assert.equal(parse(zeroWidthWindow).message, 'invalid');

    const now = Date.now();
    const invertedRange = await postPass({
      validFrom: new Date(now + 2 * 3_600_000).toISOString(),
      validUntil: new Date(now + 3_600_000).toISOString(),
    });
    assert.equal(invertedRange.statusCode, 400, invertedRange.body);
    assert.equal(parse(invertedRange).message, 'invalid');

    // A zero-length pass can never be used: reject it as incoherent instead of
    // storing something the guard will always deny.
    const sameInstant = new Date(now).toISOString();
    const zeroLength = await postPass({ validFrom: sameInstant, validUntil: sameInstant });
    assert.equal(zeroLength.statusCode, 400, zeroLength.body);
    assert.equal(parse(zeroLength).message, 'invalid');
  });

  it('returns the readable rule and the remaining uses in the pass detail', async () => {
    const weekly = await createPass({
      type: 'entry_exit',
      recurrence: 'weekly',
      allowedDays: [5, 1, 3],
      timeFrom: '08:00',
      timeTo: '17:00',
      maxUses: 2,
    });

    const weeklyDetail = await request(
      'GET',
      `/api/passes/${weekly.pass.id}`,
      undefined,
      residentToken,
    );
    assert.equal(weeklyDetail.statusCode, 200, weeklyDetail.body);
    const weeklyBody = parse(weeklyDetail);
    assert.deepEqual(weeklyBody.rule.recurrence, 'weekly');
    assert.deepEqual(weeklyBody.rule.allowedDays, [1, 3, 5]);
    assert.equal(weeklyBody.rule.timeFrom, '08:00');
    assert.equal(weeklyBody.rule.timeTo, '17:00');
    assert.equal(weeklyBody.rule.maxUses, 2);
    assert.equal(weeklyBody.rule.remainingUses, 2);
    assert.match(
      String(weeklyBody.rule.summary),
      /^Lunes, miércoles y viernes del \d{2}\/\d{2}\/\d{4} al \d{2}\/\d{2}\/\d{4}/,
    );
    assert.match(String(weeklyBody.rule.summary), /de 08:00 a 17:00/);
    assert.match(String(weeklyBody.rule.summary), /quedan 2 usos hoy$/);

    // A range pass allows today, so the pair can be consumed and the counter
    // shown by the detail must come from the confirmed scans.
    const range = await createPass({ type: 'entry_exit', recurrence: 'range', maxUses: 2 });
    const token = linkToken(range);
    const { cookie } = await bind(token);

    const entryQr = parse(await publicQr(token, cookie)).token as string;
    const entry = await scan(entryQr);
    assert.equal(entry.statusCode, 200, entry.body);
    const entryBody = parse(entry);
    assert.equal(entryBody.authorized, true, entry.body);

    const confirmedEntry = await confirm(entryBody.scanId as string);
    assert.equal(confirmedEntry.statusCode, 200, confirmedEntry.body);

    const exitQr = parse(await publicQr(token, cookie)).token as string;
    const exit = await scan(exitQr);
    const exitBody = parse(exit);
    assert.equal(exitBody.authorized, true, exit.body);
    const confirmedExit = await confirm(exitBody.scanId as string);
    assert.equal(confirmedExit.statusCode, 200, confirmedExit.body);

    const rangeDetail = await request(
      'GET',
      `/api/passes/${range.pass.id}`,
      undefined,
      residentToken,
    );
    assert.equal(rangeDetail.statusCode, 200, rangeDetail.body);
    const rangeBody = parse(rangeDetail);
    assert.equal(rangeBody.rule.remainingUses, 1);
    assert.match(String(rangeBody.rule.summary), /quedan 1 uso hoy$/);
  });

  it('describes a recurring pass without an end date as permanent', async () => {
    const created = await createPass({
      type: 'entry_exit',
      recurrence: 'weekly',
      allowedDays: [1, 3],
      validUntil: PERMANENT_PASS_UNTIL,
    });

    const detail = await request('GET', `/api/passes/${created.pass.id}`, undefined, residentToken);
    assert.equal(detail.statusCode, 200, detail.body);
    const summary = String(parse(detail).rule.summary);
    assert.match(summary, /^Lunes y miércoles desde el \d{2}\/\d{2}\/\d{4} de forma permanente/);
    assert.doesNotMatch(summary, /9999/);
  });

  it('filters by creation date and orders the history by it', async () => {
    const older = await createPass({ visitorFirstName: 'Historial', visitorLastName: 'Enero' });
    const newer = await createPass({ visitorFirstName: 'Historial', visitorLastName: 'Febrero' });

    await db
      .update(accessPasses)
      .set({ createdAt: new Date('2024-01-10T12:00:00.000Z') })
      .where(eq(accessPasses.id, older.pass.id));
    await db
      .update(accessPasses)
      .set({ createdAt: new Date('2024-02-10T12:00:00.000Z') })
      .where(eq(accessPasses.id, newer.pass.id));

    const idsFrom = async (query: string) => {
      const response = await request('GET', `/api/passes?${query}`, undefined, residentToken);
      assert.equal(response.statusCode, 200, response.body);
      const body = parse(response) as Array<{ id: string }>;
      return body.map((item) => item.id);
    };

    const desc = await idsFrom('sort=createdAt&order=desc&pageSize=100');
    assert.ok(desc.indexOf(newer.pass.id) < desc.indexOf(older.pass.id));

    const asc = await idsFrom('sort=createdAt&order=asc&pageSize=100');
    assert.ok(asc.indexOf(older.pass.id) < asc.indexOf(newer.pass.id));

    const february = await idsFrom(
      'dateFrom=2024-02-01T00:00:00.000Z&dateTo=2024-02-29T23:59:59.999Z&pageSize=100',
    );
    assert.ok(february.includes(newer.pass.id));
    assert.ok(!february.includes(older.pass.id));
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

  it('keeps two passes authorized when the same client opens both', async () => {
    const first = await createPass();
    const second = await createPass();
    const firstToken = linkToken(first);
    const secondToken = linkToken(second);

    const firstBind = await bindCookies(firstToken);
    const secondBind = await bindCookies(secondToken);

    // The same client now holds one binding per pass plus the last legacy value.
    const client = cookieHeader({ ...firstBind.cookies, ...secondBind.cookies });

    const firstQr = await app.inject({
      method: 'GET',
      url: `/api/public/passes/${firstToken}/qr`,
      headers: { cookie: client },
    });
    const secondQr = await app.inject({
      method: 'GET',
      url: `/api/public/passes/${secondToken}/qr`,
      headers: { cookie: client },
    });

    assert.equal(firstQr.statusCode, 200, firstQr.body);
    assert.equal(secondQr.statusCode, 200, secondQr.body);
    assert.notEqual(parse(firstQr).message, 'not_bound');
    assert.notEqual(parse(secondQr).message, 'not_bound');
    assert.ok(parse(firstQr).token);
    assert.ok(parse(secondQr).token);
  });

  it('still rejects a third device on an already bound pass', async () => {
    const created = await createPass();
    const token = linkToken(created);
    const bound = await bindCookies(token);

    assert.ok(bound.cookies[`pass_device_${created.pass.id}`], 'expected the pass-scoped cookie');

    const thirdDevice = await request('POST', `/api/public/passes/${token}/bind`, {});
    assert.equal(thirdDevice.statusCode, 403);
    assert.equal(parse(thirdDevice).message, 'device_already_bound');

    const original = await app.inject({
      method: 'GET',
      url: `/api/public/passes/${token}/qr`,
      headers: { cookie: cookieHeader(bound.cookies) },
    });
    assert.equal(original.statusCode, 200, original.body);
  });

  it('keeps access for a client that only presents the legacy cookie', async () => {
    const created = await createPass();
    const token = linkToken(created);
    const bound = await bindCookies(token);

    const legacy = bound.cookies.pass_device;
    assert.ok(legacy, 'expected the legacy cookie during the transition');

    const qr = await app.inject({
      method: 'GET',
      url: `/api/public/passes/${token}/qr`,
      headers: { cookie: `pass_device=${legacy}` },
    });
    assert.equal(qr.statusCode, 200, qr.body);

    const status = await app.inject({
      method: 'GET',
      url: `/api/public/passes/${token}/status`,
      headers: { cookie: `pass_device=${legacy}` },
    });
    assert.equal(status.statusCode, 200, status.body);
  });

  it('reopens the first pass after opening a second one', async () => {
    const first = await createPass();
    const second = await createPass();
    const firstToken = linkToken(first);
    const secondToken = linkToken(second);

    const firstBind = await bindCookies(firstToken);
    const secondBind = await bindCookies(secondToken);
    const client = cookieHeader({ ...firstBind.cookies, ...secondBind.cookies });

    const preview = await app.inject({
      method: 'GET',
      url: `/api/public/passes/${firstToken}`,
      headers: { cookie: client },
    });
    assert.equal(preview.statusCode, 200, preview.body);

    const qr = await app.inject({
      method: 'GET',
      url: `/api/public/passes/${firstToken}/qr`,
      headers: { cookie: client },
    });
    assert.equal(qr.statusCode, 200, qr.body);
    assert.ok(parse(qr).token);

    // Reopening does not hand the pass to another device.
    const thirdDevice = await request('POST', `/api/public/passes/${firstToken}/bind`, {});
    assert.equal(thirdDevice.statusCode, 403);
    assert.equal(parse(thirdDevice).message, 'device_already_bound');
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

  it('returns the companions in the QR scan response', async () => {
    const companions = [
      { firstName: 'Ana', lastName: 'Pérez', document: 'SCAN-COMP-A' },
      { firstName: 'Luis', lastName: 'Gómez', document: 'SCAN-COMP-B' },
    ];
    const created = await createPass({ type: 'entry_exit', companions });
    const token = linkToken(created);
    const { cookie } = await bind(token);
    const qr = parse(await publicQr(token, cookie)).token as string;

    const scanned = await scan(qr);
    assert.equal(scanned.statusCode, 200, scanned.body);
    const body = parse(scanned);
    assert.equal(body.authorized, true);
    assert.deepEqual(body.companions, companions);
  });

  it('records the guard note when a scan is confirmed', async () => {
    const created = await createPass({ type: 'entry_exit' });
    const token = linkToken(created);
    const { cookie } = await bind(token);
    const qr = parse(await publicQr(token, cookie)).token as string;
    const scanned = parse(await scan(qr));

    const confirmed = await request(
      'POST',
      `/api/access/scans/${scanned.scanId as string}/confirm`,
      { note: '  Llega con equipaje  ' },
      guardToken,
    );
    assert.equal(confirmed.statusCode, 200, confirmed.body);

    const [row] = await db
      .select()
      .from(passScans)
      .where(eq(passScans.id, scanned.scanId as string));
    assert.equal(row?.note, 'Llega con equipaje');

    const bitacora = await request(
      'GET',
      `/api/bitacora/${parse(confirmed).bitacoraEntryId as string}`,
      undefined,
      guardToken,
    );
    assert.equal(bitacora.statusCode, 200, bitacora.body);
    const details = parse(bitacora).details as Json;
    assert.equal(details.note, 'Llega con equipaje');

    // The guard activity reads the list endpoint filtered by the current shift:
    // the note must survive that exact path, not only the detail endpoint.
    const current = await request('GET', '/api/guard/shifts/current', undefined, guardToken);
    assert.equal(current.statusCode, 200, current.body);
    const shiftId = parse(current).shift?.id as string | undefined;
    assert.ok(shiftId, 'the guard must have an open shift');

    const list = await request(
      'GET',
      `/api/bitacora?shiftId=${shiftId}&pageSize=100`,
      undefined,
      guardToken,
    );
    assert.equal(list.statusCode, 200, list.body);
    const listedEntry = (parse(list).items as Json[]).find(
      (item) => item.id === parse(confirmed).bitacoraEntryId,
    );
    assert.ok(listedEntry, 'the confirmed entry must appear in the guard activity');
    assert.equal((listedEntry.details as Json).note, 'Llega con equipaje');
  });

  it('records the note as the rejection reason and in the audit', async () => {
    const created = await createPass({ type: 'entry_exit' });
    const token = linkToken(created);
    const { cookie } = await bind(token);
    const qr = parse(await publicQr(token, cookie)).token as string;
    const scanned = parse(await scan(qr));

    const rejected = await request(
      'POST',
      `/api/access/scans/${scanned.scanId as string}/reject`,
      { note: '  Documento ilegible  ' },
      guardToken,
    );
    assert.equal(rejected.statusCode, 200, rejected.body);

    const [row] = await db
      .select()
      .from(passScans)
      .where(eq(passScans.id, scanned.scanId as string));
    assert.equal(row?.note, 'Documento ilegible');
    assert.equal(row?.reason, 'Documento ilegible');

    const bitacora = await request(
      'GET',
      `/api/bitacora/${parse(rejected).bitacoraEntryId as string}`,
      undefined,
      guardToken,
    );
    assert.equal(bitacora.statusCode, 200, bitacora.body);
    const details = parse(bitacora).details as Json;
    assert.equal(details.note, 'Documento ilegible');
    assert.equal(details.reason, 'Documento ilegible');

    const current = await request('GET', '/api/guard/shifts/current', undefined, guardToken);
    assert.equal(current.statusCode, 200, current.body);
    const shiftId = parse(current).shift?.id as string | undefined;
    assert.ok(shiftId, 'the guard must have an open shift');

    const list = await request(
      'GET',
      `/api/bitacora?shiftId=${shiftId}&pageSize=100`,
      undefined,
      guardToken,
    );
    assert.equal(list.statusCode, 200, list.body);
    const listedEntry = (parse(list).items as Json[]).find(
      (item) => item.id === parse(rejected).bitacoraEntryId,
    );
    assert.ok(listedEntry, 'the rejection must appear in the guard activity');
    assert.equal((listedEntry.details as Json).note, 'Documento ilegible');
  });

  it('rejects a scan note longer than 500 characters', async () => {
    const created = await createPass({ type: 'entry_exit' });
    const token = linkToken(created);
    const { cookie } = await bind(token);
    const qr = parse(await publicQr(token, cookie)).token as string;
    const scanned = parse(await scan(qr));

    const tooLong = await request(
      'POST',
      `/api/access/scans/${scanned.scanId as string}/confirm`,
      { note: 'x'.repeat(501) },
      guardToken,
    );
    assert.equal(tooLong.statusCode, 400, tooLong.body);
    assert.equal(parse(tooLong).message, 'Validation error');
  });

  it('rejects a pending scan without changing the pass', async () => {
    const created = await createPass({ type: 'entry_exit' });
    const token = linkToken(created);
    const { cookie } = await bind(token);
    const qr = parse(await publicQr(token, cookie)).token as string;
    const scanned = parse(await scan(qr));

    const rejected = await reject(scanned.scanId as string, 'denied_by_guard');
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
    const rejectedEntry = parse(rejectedBitacora);
    assert.ok(rejectedEntry.authorizedByName);
    assert.equal(rejectedEntry.details.reason, 'denied_by_guard');
    assert.match(String(rejectedEntry.details.rule), /1 uso en total/);

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

    // Older than the 180 s default so the test does not sit on the boundary.
    await db
      .update(passScans)
      .set({ scannedAt: new Date(Date.now() - 4 * 60_000) })
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

  it('denies out-of-validity scans without creating a pending scan', async () => {
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
    assert.equal(body.reason, 'not_valid_now');
    assert.equal(body.scanId, null);

    const scans = await db
      .select({ id: passScans.id })
      .from(passScans)
      .where(eq(passScans.passId, created.pass.id));
    assert.equal(scans.length, 0, 'a denied scan never reaches the pending state');
  });

  it('allows a weekly pass on a marked day and rejects it on an unmarked one', async () => {
    const now = new Date();
    const today = now.getUTCDay();
    const tomorrow = (today + 1) % 7;
    const validFrom = new Date(now.getTime() - 60_000).toISOString();
    const validUntil = new Date(now.getTime() + 86_400_000).toISOString();

    const allowed = await createPass({
      type: 'entry_exit',
      recurrence: 'weekly',
      allowedDays: [today],
      maxUses: 1,
      validFrom,
      validUntil,
    });
    const allowedToken = linkToken(allowed);
    const allowedBind = await bind(allowedToken);
    const allowedQr = parse(await publicQr(allowedToken, allowedBind.cookie)).token as string;
    const allowedScan = parse(await scan(allowedQr));
    assert.equal(allowedScan.authorized, true);
    const allowedConfirm = await confirm(allowedScan.scanId as string);
    assert.equal(allowedConfirm.statusCode, 200, allowedConfirm.body);

    const blocked = await createPass({
      type: 'entry_exit',
      recurrence: 'weekly',
      allowedDays: [tomorrow],
      maxUses: 1,
      validFrom,
      validUntil,
    });
    const blockedToken = linkToken(blocked);
    const blockedBind = await bind(blockedToken);
    const blockedQr = parse(await publicQr(blockedToken, blockedBind.cookie)).token as string;
    const blockedScan = parse(await scan(blockedQr));
    assert.equal(blockedScan.authorized, false);
    assert.equal(blockedScan.reason, 'out_of_days');
    assert.equal(blockedScan.scanId, null);
  });

  it('rejects an entry when the allowed days change before the confirmation', async () => {
    const now = new Date();
    const today = now.getUTCDay();
    const tomorrow = (today + 1) % 7;

    const created = await createPass({
      type: 'entry_exit',
      recurrence: 'weekly',
      allowedDays: [today],
      maxUses: 1,
      validFrom: new Date(now.getTime() - 60_000).toISOString(),
      validUntil: new Date(now.getTime() + 86_400_000).toISOString(),
    });
    const token = linkToken(created);
    const { cookie } = await bind(token);
    const qr = parse(await publicQr(token, cookie)).token as string;
    const scanned = parse(await scan(qr));
    assert.equal(scanned.authorized, true);

    // The scan read the pass, but the rule can change before the guard confirms.
    await db
      .update(accessPasses)
      .set({ allowedDays: [tomorrow] })
      .where(eq(accessPasses.id, created.pass.id));

    const confirmed = await confirm(scanned.scanId as string);
    assert.equal(confirmed.statusCode, 409, confirmed.body);
    assert.equal(parse(confirmed).message, 'out_of_days');
  });

  it('rejects an entry outside the schedule at confirmation', async () => {
    const created = await createPass({
      type: 'entry_exit',
      validFrom: new Date(Date.now() - 60_000).toISOString(),
      validUntil: new Date(Date.now() + 86_400_000).toISOString(),
      timeFrom: '00:00',
      timeTo: '23:59',
    });
    const token = linkToken(created);
    const { cookie } = await bind(token);
    const qr = parse(await publicQr(token, cookie)).token as string;
    const scanned = parse(await scan(qr));
    assert.equal(scanned.authorized, true);

    const minutes = new Date().getUTCHours() * 60 + new Date().getUTCMinutes();
    const format = (value: number) =>
      `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
    await db
      .update(accessPasses)
      .set({
        timeFrom: format((minutes + 120) % (24 * 60)),
        timeTo: format((minutes + 180) % (24 * 60)),
      })
      .where(eq(accessPasses.id, created.pass.id));

    const confirmed = await confirm(scanned.scanId as string);
    assert.equal(confirmed.statusCode, 409, confirmed.body);
    assert.equal(parse(confirmed).message, 'out_of_schedule');
  });

  it('exhausts the daily uses and resets them on the next local day', async () => {
    const created = await createPass({
      type: 'entry_exit',
      recurrence: 'range',
      maxUses: 1,
      validFrom: new Date(Date.now() - 60_000).toISOString(),
      validUntil: new Date(Date.now() + 2 * 86_400_000).toISOString(),
    });
    const token = linkToken(created);
    const { cookie } = await bind(token);

    const entryQr = parse(await publicQr(token, cookie)).token as string;
    const entry = parse(await scan(entryQr));
    assert.equal((await confirm(entry.scanId as string)).statusCode, 200);

    const exitQr = parse(await publicQr(token, cookie)).token as string;
    const exit = parse(await scan(exitQr));
    const exitConfirm = await confirm(exit.scanId as string);
    assert.equal(exitConfirm.statusCode, 200, exitConfirm.body);
    assert.equal(
      parse(exitConfirm).passStatus,
      'active',
      'a recurring pass is not consumed by a pair',
    );

    const blockedQr = parse(await publicQr(token, cookie)).token as string;
    const blocked = parse(await scan(blockedQr));
    assert.equal(blocked.authorized, false, 'the scan already sees the exhausted counter');
    assert.equal(blocked.reason, 'daily_uses_exhausted');
    assert.equal(blocked.scanId, null);

    // The counter is date-based: moving the completed pair to yesterday resets it.
    const yesterday = new Date(Date.now() - 86_400_000);
    await db
      .update(passScans)
      .set({ scannedAt: yesterday, confirmedAt: yesterday })
      .where(eq(passScans.id, exit.scanId as string));

    const retryQr = parse(await publicQr(token, cookie)).token as string;
    const retry = parse(await scan(retryQr));
    assert.equal(retry.authorized, true);
    assert.equal((await confirm(retry.scanId as string)).statusCode, 200);
  });

  it('exhausts a recurring pass and reports it through the shared ticket state', async () => {
    const created = await createPass({ type: 'entry_exit', recurrence: 'range', maxUses: 2 });
    const token = linkToken(created);
    const { cookie } = await bind(token);

    for (let cycle = 1; cycle <= 2; cycle += 1) {
      await completeCycle(token, cookie);
    }

    const detail = await request('GET', `/api/passes/${created.pass.id}`, undefined, residentToken);
    assert.equal(detail.statusCode, 200, detail.body);
    const detailBody = parse(detail);
    assert.equal(detailBody.rule.remainingUses, 0);
    assert.equal(detailBody.exitCount, 2);

    const blockedQr = parse(await publicQr(token, cookie)).token as string;
    const blocked = parse(await scan(blockedQr));
    assert.equal(blocked.authorized, false);
    assert.equal(blocked.reason, 'daily_uses_exhausted');
    assert.equal(blocked.scanId, null);

    const ticket = passTicketState(detailBody);
    assert.equal(ticket.kind, 'exhausted');
    assert.equal(ticket.tone, 'danger');
    assert.equal(ticket.label, 'Sin usos hoy');
  });

  it('maps every pass modality to the shared ticket state from the real payloads', async () => {
    // The helper reads these fields; if the API stops sending one the mapping
    // would silently degrade, so the contract is checked before each mapping.
    const requireTicketFields = (body: Json, context: string) => {
      for (const field of [
        'type',
        'status',
        'presenceState',
        'recurrence',
        'maxUses',
        'exitCount',
        'validUntil',
      ]) {
        assert.ok(field in body, `${context}: the API payload must carry ${field}`);
      }
      assert.ok(body.rule, `${context}: the API payload must carry the readable rule`);
      assert.equal(
        typeof body.rule.remainingUses,
        'number',
        `${context}: rule.remainingUses must be a number`,
      );
    };

    const passDetail = async (passId: string) => {
      const response = await request('GET', `/api/passes/${passId}`, undefined, residentToken);
      assert.equal(response.statusCode, 200, response.body);
      return parse(response);
    };

    const fresh = await createPass({ type: 'entry_only' });
    const freshBody = await passDetail(fresh.pass.id);
    requireTicketFields(freshBody, 'entry_only fresh');
    const freshTicket = passTicketState(freshBody);
    assert.equal(freshTicket.kind, 'pending');
    assert.equal(freshTicket.tone, 'success');
    assert.equal(freshTicket.label, 'Pendiente de ingreso');

    const singleEntry = await createPass({ type: 'entry_only' });
    const singleToken = linkToken(singleEntry);
    const singleBind = await bind(singleToken);
    const singleQr = parse(await publicQr(singleToken, singleBind.cookie)).token as string;
    const singleScan = parse(await scan(singleQr));
    const singleConfirm = await confirm(singleScan.scanId as string);
    assert.equal(singleConfirm.statusCode, 200, singleConfirm.body);

    const usedBody = await passDetail(singleEntry.pass.id);
    requireTicketFields(usedBody, 'entry_only used');
    assert.equal(usedBody.status, 'used');
    const usedTicket = passTicketState(usedBody);
    assert.equal(usedTicket.kind, 'used');
    assert.equal(usedTicket.label, 'Usado');

    const visiting = await createPass({ type: 'entry_exit' });
    const visitingToken = linkToken(visiting);
    const visitingBind = await bind(visitingToken);
    const visitingQr = parse(await publicQr(visitingToken, visitingBind.cookie)).token as string;
    const visitingScan = parse(await scan(visitingQr));
    const visitingConfirm = await confirm(visitingScan.scanId as string);
    assert.equal(visitingConfirm.statusCode, 200, visitingConfirm.body);

    const insideBody = await passDetail(visiting.pass.id);
    requireTicketFields(insideBody, 'entry_exit inside');
    const insideTicket = passTicketState(insideBody);
    assert.equal(insideTicket.kind, 'inside');
    assert.equal(insideTicket.tone, 'warning');
    assert.equal(insideTicket.label, 'Adentro · esperando salida');

    const recurring = await createPass({ type: 'entry_exit', recurrence: 'range', maxUses: 2 });
    const recurringToken = linkToken(recurring);
    const recurringBind = await bind(recurringToken);
    await completeCycle(recurringToken, recurringBind.cookie);

    const reentryBody = await passDetail(recurring.pass.id);
    requireTicketFields(reentryBody, 'entry_exit after exit');
    assert.equal(reentryBody.rule.remainingUses, 1);
    const reentryTicket = passTicketState(reentryBody);
    assert.equal(reentryTicket.kind, 'reentry');
    assert.equal(reentryTicket.tone, 'success');
    assert.equal(reentryTicket.label, 'Puede volver a entrar');
  });

  it('pins presenceState and exitCount for entry_only and entry_exit', async () => {
    const entryOnly = await createPass({ type: 'entry_only' });
    const entryOnlyToken = linkToken(entryOnly);
    const entryOnlyBind = await bind(entryOnlyToken);
    const entryOnlyQr = parse(await publicQr(entryOnlyToken, entryOnlyBind.cookie)).token as string;
    const entryOnlyScan = parse(await scan(entryOnlyQr));
    assert.equal(entryOnlyScan.presenceState, 'outside', 'the scan reads the pre-entry state');
    const entryOnlyConfirm = parse(await confirm(entryOnlyScan.scanId as string));

    // The confirmation carries the presence but not the counter: exitCount only
    // travels in the pass detail and the public status payload today.
    assert.equal(entryOnlyConfirm.status, 'confirmed');
    assert.equal(entryOnlyConfirm.action, 'entry');
    assert.equal(entryOnlyConfirm.presenceState, 'inside');
    assert.equal(entryOnlyConfirm.passStatus, 'used');

    const entryOnlyDetail = parse(
      await request('GET', `/api/passes/${entryOnly.pass.id}`, undefined, residentToken),
    );
    assert.equal(entryOnlyDetail.presenceState, 'inside');
    assert.equal(
      entryOnlyDetail.exitCount,
      0,
      'an entry_only entry consumes on entry, not on exit',
    );
    assert.equal(entryOnlyDetail.entryCount, 1);

    const entryExit = await createPass({ type: 'entry_exit', recurrence: 'range', maxUses: 2 });
    const entryExitToken = linkToken(entryExit);
    const entryExitBind = await bind(entryExitToken);

    const entryQr = parse(await publicQr(entryExitToken, entryExitBind.cookie)).token as string;
    const entryScan = parse(await scan(entryQr));
    const entryConfirm = parse(await confirm(entryScan.scanId as string));
    assert.equal(entryConfirm.action, 'entry');
    assert.equal(entryConfirm.presenceState, 'inside');
    assert.equal(entryConfirm.passStatus, 'active');

    const afterEntry = parse(
      await request('GET', `/api/passes/${entryExit.pass.id}`, undefined, residentToken),
    );
    assert.equal(afterEntry.presenceState, 'inside');
    assert.equal(afterEntry.exitCount, 0);
    assert.equal(afterEntry.entryCount, 1);

    const exitQr = parse(await publicQr(entryExitToken, entryExitBind.cookie)).token as string;
    const exitScan = parse(await scan(exitQr));
    assert.equal(exitScan.action, 'exit');
    const exitConfirm = parse(await confirm(exitScan.scanId as string));
    assert.equal(exitConfirm.action, 'exit');
    assert.equal(exitConfirm.presenceState, 'outside');
    assert.equal(exitConfirm.passStatus, 'active');

    const afterExit = parse(
      await request('GET', `/api/passes/${entryExit.pass.id}`, undefined, residentToken),
    );
    assert.equal(afterExit.presenceState, 'outside');
    assert.equal(afterExit.exitCount, 1);
    assert.equal(afterExit.entryCount, 1);
    assert.equal(afterExit.rule.remainingUses, 1);
  });

  it('rejects a use consumed between the scan and the confirmation', async () => {
    const created = await createPass({
      type: 'entry_exit',
      recurrence: 'range',
      maxUses: 2,
      validFrom: new Date(Date.now() - 60_000).toISOString(),
      validUntil: new Date(Date.now() + 2 * 86_400_000).toISOString(),
    });
    const token = linkToken(created);
    const { cookie } = await bind(token);

    const firstEntry = parse(await scan(parse(await publicQr(token, cookie)).token as string));
    assert.equal((await confirm(firstEntry.scanId as string)).statusCode, 200);
    const firstExit = parse(await scan(parse(await publicQr(token, cookie)).token as string));
    assert.equal((await confirm(firstExit.scanId as string)).statusCode, 200);

    // One use is consumed, so the scan still sees a free slot.
    const pending = parse(await scan(parse(await publicQr(token, cookie)).token as string));
    assert.equal(pending.authorized, true);

    // Another guard finishes a second pair while this scan waits for confirmation.
    await db.insert(passScans).values({
      passId: created.pass.id,
      guardPersonId,
      communityId,
      locationUnitId: leafAId,
      structureId,
      visitorFirstName: 'Visitante',
      visitorLastName: 'Prueba',
      visitorDocument: '12345678',
      action: 'exit',
      result: 'authorized',
      tokenJti: randomUUID(),
      status: 'confirmed',
      scannedAt: new Date(),
      confirmedAt: new Date(),
    });

    const confirmed = await confirm(pending.scanId as string);
    assert.equal(confirmed.statusCode, 409, confirmed.body);
    assert.equal(parse(confirmed).message, 'daily_uses_exhausted');
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

  it('rejects pass creation after the community daily limit', async () => {
    // The limit is a rule of the community now, so the test states it instead of
    // leaning on the environment default.
    await db
      .update(communities)
      .set({ passDailyLimitEnabled: true, passDailyLimit: 20 })
      .where(eq(communities.id, communityId));

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
    // The rejection states the maximum, so the client can explain it.
    assert.equal(parse(blocked).max, 20);
  });

  it('skips the daily limit when the community turns it off', async () => {
    await db
      .update(communities)
      .set({ passDailyLimitEnabled: false, passDailyLimit: 20 })
      .where(eq(communities.id, communityId));

    // Twenty passes are already there from the test above; with the rule off the
    // count must not even run.
    const allowed = await postPass({ locationUnitId: leafBId }, otherResidentToken);
    assert.equal(allowed.statusCode, 201, allowed.body);

    await db
      .update(communities)
      .set({ passDailyLimitEnabled: false })
      .where(eq(communities.id, communityId));
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
