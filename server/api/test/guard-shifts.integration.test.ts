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
  accessPoints,
  accounts,
  bitacoraEntries,
  communities,
  guardShifts,
  memberships,
  organizations,
  people,
  users,
} from '@porteria/database/schema';

const db = createDb();

let app: FastifyInstance;
let organizationId: string;
let communityId: string;
let accessPointAId: string;
let accessPointBId: string;
let guardPersonId: string;
let guardUserId: string;
let guardAccountId: string;
let guardMembershipId: string;
let guardToken: string;
let secondGuardPersonId: string;
let secondGuardUserId: string;
let secondGuardAccountId: string;
let secondGuardToken: string;
let idleGuardPersonId: string;
let idleGuardUserId: string;
let idleGuardAccountId: string;
let idleGuardToken: string;
let communityAdminPersonId: string;
let communityAdminUserId: string;
let communityAdminAccountId: string;
let communityAdminToken: string;
let orgAdminPersonId: string;
let orgAdminUserId: string;
let orgAdminAccountId: string;
let orgAdminToken: string;
let operatorPersonId: string;
let operatorUserId: string;
let operatorAccountId: string;
let operatorToken: string;
let residentPersonId: string;
let residentUserId: string;
let residentAccountId: string;
let residentToken: string;

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

async function startShift(token: string, accessPointId?: string) {
  return request('POST', '/api/guard/shifts/start', accessPointId ? { accessPointId } : {}, token);
}

describe('guard shifts and access bitacora integration', () => {
  before(async () => {
    const suffix = randomUUID().slice(0, 8);

    const [organization] = await db
      .insert(organizations)
      .values({ name: `Shift Test Org ${suffix}`, slug: `shift-test-org-${suffix}` })
      .returning();
    organizationId = organization.id;

    const [community] = await db
      .insert(communities)
      .values({
        organizationId,
        name: `Shift Test Community ${suffix}`,
        slug: `shift-test-community-${suffix}`,
        address: 'Calle Turnos 123',
        timezone: 'UTC',
      })
      .returning();
    communityId = community.id;

    const [accessPointA, accessPointB] = await db
      .insert(accessPoints)
      .values([
        {
          communityId,
          name: `Portón A ${suffix}`,
          type: 'gate',
          direction: 'both',
          active: true,
        },
        {
          communityId,
          name: `Portón B ${suffix}`,
          type: 'gate',
          direction: 'both',
          active: true,
        },
      ])
      .returning();
    accessPointAId = accessPointA.id;
    accessPointBId = accessPointB.id;

    const [guardPerson] = await db
      .insert(people)
      .values({ firstName: 'Guardia', lastName: 'Turno', status: 'active' })
      .returning();
    guardPersonId = guardPerson.id;

    const [secondGuardPerson] = await db
      .insert(people)
      .values({ firstName: 'Guardia', lastName: 'Segundo', status: 'active' })
      .returning();
    secondGuardPersonId = secondGuardPerson.id;

    const [idleGuardPerson] = await db
      .insert(people)
      .values({ firstName: 'Guardia', lastName: 'Sin Turno', status: 'active' })
      .returning();
    idleGuardPersonId = idleGuardPerson.id;

    const [communityAdminPerson] = await db
      .insert(people)
      .values({ firstName: 'Admin', lastName: 'Comunidad', status: 'active' })
      .returning();
    communityAdminPersonId = communityAdminPerson.id;

    const [orgAdminPerson] = await db
      .insert(people)
      .values({ firstName: 'Admin', lastName: 'Organizacion', status: 'active' })
      .returning();
    orgAdminPersonId = orgAdminPerson.id;

    const [operatorPerson] = await db
      .insert(people)
      .values({ firstName: 'Operador', lastName: 'Central', status: 'active' })
      .returning();
    operatorPersonId = operatorPerson.id;

    const [residentPerson] = await db
      .insert(people)
      .values({ firstName: 'Residente', lastName: 'Bitacora', status: 'active' })
      .returning();
    residentPersonId = residentPerson.id;

    const [guardUser] = await db
      .insert(users)
      .values({ email: `shift-guard-${suffix}@test.local`, passwordHash: 'x', name: 'Guard' })
      .returning();
    guardUserId = guardUser.id;

    const [secondGuardUser] = await db
      .insert(users)
      .values({
        email: `shift-second-guard-${suffix}@test.local`,
        passwordHash: 'x',
        name: 'Second Guard',
      })
      .returning();
    secondGuardUserId = secondGuardUser.id;

    const [idleGuardUser] = await db
      .insert(users)
      .values({
        email: `shift-idle-guard-${suffix}@test.local`,
        passwordHash: 'x',
        name: 'Idle Guard',
      })
      .returning();
    idleGuardUserId = idleGuardUser.id;

    const [communityAdminUser] = await db
      .insert(users)
      .values({
        email: `shift-community-admin-${suffix}@test.local`,
        passwordHash: 'x',
        name: 'Community Admin',
      })
      .returning();
    communityAdminUserId = communityAdminUser.id;

    const [orgAdminUser] = await db
      .insert(users)
      .values({
        email: `shift-org-admin-${suffix}@test.local`,
        passwordHash: 'x',
        name: 'Org Admin',
      })
      .returning();
    orgAdminUserId = orgAdminUser.id;

    const [operatorUser] = await db
      .insert(users)
      .values({
        email: `shift-operator-${suffix}@test.local`,
        passwordHash: 'x',
        name: 'Operator',
      })
      .returning();
    operatorUserId = operatorUser.id;

    const [residentUser] = await db
      .insert(users)
      .values({
        email: `shift-resident-${suffix}@test.local`,
        passwordHash: 'x',
        name: 'Resident',
      })
      .returning();
    residentUserId = residentUser.id;

    const [guardAccount] = await db
      .insert(accounts)
      .values({
        personId: guardPersonId,
        email: `shift-guard-${suffix}@test.local`,
        passwordHash: 'x',
      })
      .returning();
    guardAccountId = guardAccount.id;

    const [secondGuardAccount] = await db
      .insert(accounts)
      .values({
        personId: secondGuardPersonId,
        email: `shift-second-guard-${suffix}@test.local`,
        passwordHash: 'x',
      })
      .returning();
    secondGuardAccountId = secondGuardAccount.id;

    const [idleGuardAccount] = await db
      .insert(accounts)
      .values({
        personId: idleGuardPersonId,
        email: `shift-idle-guard-${suffix}@test.local`,
        passwordHash: 'x',
      })
      .returning();
    idleGuardAccountId = idleGuardAccount.id;

    const [communityAdminAccount] = await db
      .insert(accounts)
      .values({
        personId: communityAdminPersonId,
        email: `shift-community-admin-${suffix}@test.local`,
        passwordHash: 'x',
      })
      .returning();
    communityAdminAccountId = communityAdminAccount.id;

    const [orgAdminAccount] = await db
      .insert(accounts)
      .values({
        personId: orgAdminPersonId,
        email: `shift-org-admin-${suffix}@test.local`,
        passwordHash: 'x',
      })
      .returning();
    orgAdminAccountId = orgAdminAccount.id;

    const [operatorAccount] = await db
      .insert(accounts)
      .values({
        personId: operatorPersonId,
        email: `shift-operator-${suffix}@test.local`,
        passwordHash: 'x',
      })
      .returning();
    operatorAccountId = operatorAccount.id;

    const [residentAccount] = await db
      .insert(accounts)
      .values({
        personId: residentPersonId,
        email: `shift-resident-${suffix}@test.local`,
        passwordHash: 'x',
      })
      .returning();
    residentAccountId = residentAccount.id;

    const [guardMembership] = await db
      .insert(memberships)
      .values({
        userId: guardUserId,
        personId: guardPersonId,
        organizationId,
        communityId,
        locationUnitId: null,
        defaultAccessPointId: accessPointAId,
        role: 'guard',
        status: 'active',
      })
      .returning();
    guardMembershipId = guardMembership.id;

    const [secondGuardMembership] = await db
      .insert(memberships)
      .values({
        userId: secondGuardUserId,
        personId: secondGuardPersonId,
        organizationId,
        communityId,
        locationUnitId: null,
        defaultAccessPointId: accessPointAId,
        role: 'guard',
        status: 'active',
      })
      .returning();

    const [idleGuardMembership] = await db
      .insert(memberships)
      .values({
        userId: idleGuardUserId,
        personId: idleGuardPersonId,
        organizationId,
        communityId,
        locationUnitId: null,
        role: 'guard',
        status: 'active',
      })
      .returning();

    const [communityAdminMembership] = await db
      .insert(memberships)
      .values({
        userId: communityAdminUserId,
        personId: communityAdminPersonId,
        organizationId,
        communityId,
        locationUnitId: null,
        role: 'community_admin',
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

    const [operatorMembership] = await db
      .insert(memberships)
      .values({
        userId: operatorUserId,
        personId: operatorPersonId,
        organizationId,
        communityId,
        locationUnitId: null,
        role: 'operator',
        status: 'active',
      })
      .returning();

    const [residentMembership] = await db
      .insert(memberships)
      .values({
        userId: residentUserId,
        personId: residentPersonId,
        organizationId,
        communityId,
        locationUnitId: null,
        role: 'resident',
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

    guardToken = app.jwt.sign({
      ...base,
      sub: guardUserId,
      accountId: guardAccountId,
      personId: guardPersonId,
      membershipId: guardMembership.id,
      role: 'guard',
      communityId,
    });
    secondGuardToken = app.jwt.sign({
      ...base,
      sub: secondGuardUserId,
      accountId: secondGuardAccountId,
      personId: secondGuardPersonId,
      membershipId: secondGuardMembership.id,
      role: 'guard',
      communityId,
    });
    idleGuardToken = app.jwt.sign({
      ...base,
      sub: idleGuardUserId,
      accountId: idleGuardAccountId,
      personId: idleGuardPersonId,
      membershipId: idleGuardMembership.id,
      role: 'guard',
      communityId,
    });
    communityAdminToken = app.jwt.sign({
      ...base,
      sub: communityAdminUserId,
      accountId: communityAdminAccountId,
      personId: communityAdminPersonId,
      membershipId: communityAdminMembership.id,
      role: 'community_admin',
      communityId,
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
    operatorToken = app.jwt.sign({
      ...base,
      sub: operatorUserId,
      accountId: operatorAccountId,
      personId: operatorPersonId,
      membershipId: operatorMembership.id,
      role: 'operator',
      communityId,
    });
    residentToken = app.jwt.sign({
      ...base,
      sub: residentUserId,
      accountId: residentAccountId,
      personId: residentPersonId,
      membershipId: residentMembership.id,
      role: 'resident',
      communityId,
    });
  });

  after(async () => {
    await db.delete(bitacoraEntries).where(eq(bitacoraEntries.communityId, communityId));
    await db.delete(guardShifts).where(eq(guardShifts.communityId, communityId));
    await db.delete(accessPoints).where(eq(accessPoints.communityId, communityId));
    await db.delete(memberships).where(eq(memberships.organizationId, organizationId));
    await db
      .delete(users)
      .where(
        inArray(users.id, [
          guardUserId,
          secondGuardUserId,
          idleGuardUserId,
          communityAdminUserId,
          orgAdminUserId,
          operatorUserId,
          residentUserId,
        ]),
      );
    await db
      .delete(people)
      .where(
        inArray(people.id, [
          guardPersonId,
          secondGuardPersonId,
          idleGuardPersonId,
          communityAdminPersonId,
          orgAdminPersonId,
          operatorPersonId,
          residentPersonId,
        ]),
      );
    await db.delete(organizations).where(eq(organizations.id, organizationId));
    await app.close();
  });

  it('lists active access points for guards and all for admins', async () => {
    const guardList = await request(
      'GET',
      `/api/communities/${communityId}/access-points`,
      undefined,
      guardToken,
    );
    assert.equal(guardList.statusCode, 200, guardList.body);
    const guardItems = parse(guardList).items as Json[];
    assert.equal(guardItems.length, 2);
    assert.equal(
      guardItems.every((item) => item.active === true),
      true,
    );

    const adminList = await request(
      'GET',
      `/api/communities/${communityId}/access-points?includeInactive=true`,
      undefined,
      communityAdminToken,
    );
    assert.equal(adminList.statusCode, 200, adminList.body);
    assert.equal((parse(adminList).items as Json[]).length, 2);
  });

  it('creates, updates and deactivates access points with unique names', async () => {
    const created = await request(
      'POST',
      `/api/communities/${communityId}/access-points`,
      { name: 'Portón C', type: 'door', direction: 'entry' },
      communityAdminToken,
    );
    assert.equal(created.statusCode, 201, created.body);
    const accessPointCId = parse(created).id as string;

    const duplicate = await request(
      'POST',
      `/api/communities/${communityId}/access-points`,
      { name: 'Portón C', type: 'door' },
      communityAdminToken,
    );
    assert.equal(duplicate.statusCode, 409, duplicate.body);
    assert.equal(parse(duplicate).message, 'conflict');

    const updated = await request(
      'PATCH',
      `/api/communities/${communityId}/access-points/${accessPointCId}`,
      { name: 'Portón C Renombrado', direction: 'both' },
      communityAdminToken,
    );
    assert.equal(updated.statusCode, 200, updated.body);
    assert.equal(parse(updated).name, 'Portón C Renombrado');

    const deactivated = await request(
      'DELETE',
      `/api/communities/${communityId}/access-points/${accessPointCId}`,
      undefined,
      communityAdminToken,
    );
    assert.equal(deactivated.statusCode, 200, deactivated.body);
    assert.equal(parse(deactivated).active, false);

    const guardList = await request(
      'GET',
      `/api/communities/${communityId}/access-points`,
      undefined,
      guardToken,
    );
    assert.equal(
      (parse(guardList).items as Json[]).some((item) => item.id === accessPointCId),
      false,
    );

    const guardMutation = await request(
      'POST',
      `/api/communities/${communityId}/access-points`,
      { name: 'No permitido' },
      guardToken,
    );
    assert.equal(guardMutation.statusCode, 403, guardMutation.body);
  });

  it('starts a shift with the default access point and is idempotent', async () => {
    const noShift = await request('GET', '/api/guard/shifts/current', undefined, guardToken);
    assert.equal(noShift.statusCode, 200);
    assert.equal(parse(noShift).shift, null);

    const started = await startShift(guardToken);
    assert.equal(started.statusCode, 201, started.body);
    const startedBody = parse(started);
    assert.equal(startedBody.shift.status, 'open');
    assert.equal(startedBody.segment.accessPointId, accessPointAId);

    const again = await startShift(guardToken);
    assert.equal(again.statusCode, 201, again.body);
    assert.equal(parse(again).shift.id, startedBody.shift.id);

    const current = await request('GET', '/api/guard/shifts/current', undefined, guardToken);
    assert.equal(current.statusCode, 200);
    const currentBody = parse(current);
    assert.equal(currentBody.shift.id, startedBody.shift.id);
    assert.equal(currentBody.accessPoint.id, accessPointAId);
    assert.equal(currentBody.stale, false);

    const history = await request('GET', '/api/guard/shifts', undefined, guardToken);
    assert.equal(history.statusCode, 200);
    assert.equal(
      (parse(history).items as Json[]).some((item) => item.id === startedBody.shift.id),
      true,
    );

    const ended = await request(
      'POST',
      `/api/guard/shifts/${startedBody.shift.id}/end`,
      {},
      guardToken,
    );
    assert.equal(ended.statusCode, 200, ended.body);
    assert.equal(parse(ended).shift, null);

    const closedHistory = await request('GET', '/api/guard/shifts', undefined, guardToken);
    assert.equal(closedHistory.statusCode, 200, closedHistory.body);
    const closedShift = (parse(closedHistory).items as Json[]).find(
      (item) => item.id === startedBody.shift.id,
    );
    assert.equal(closedShift?.status, 'closed');

    const afterEnd = await request('GET', '/api/guard/shifts/current', undefined, guardToken);
    assert.equal(parse(afterEnd).shift, null);
  });

  it('allows two guards at the same access point and changes access mid-shift', async () => {
    const first = await startShift(guardToken, accessPointAId);
    assert.equal(first.statusCode, 201, first.body);
    const second = await startShift(secondGuardToken, accessPointAId);
    assert.equal(second.statusCode, 201, second.body);

    const active = await request(
      'GET',
      `/api/guard/active-guards?communityId=${communityId}&accessPointId=${accessPointAId}`,
      undefined,
      communityAdminToken,
    );
    assert.equal(active.statusCode, 200, active.body);
    const activeItems = parse(active).items as Json[];
    assert.equal(
      activeItems.filter(
        (item) => item.personId === guardPersonId || item.personId === secondGuardPersonId,
      ).length,
      2,
    );

    const changed = await request(
      'POST',
      `/api/guard/shifts/${parse(second).shift.id}/change-access-point`,
      { accessPointId: accessPointBId },
      secondGuardToken,
    );
    assert.equal(changed.statusCode, 200, changed.body);
    assert.equal(parse(changed).segment.accessPointId, accessPointBId);

    const historyAfterChange = await request(
      'GET',
      '/api/guard/shifts',
      undefined,
      secondGuardToken,
    );
    assert.equal(historyAfterChange.statusCode, 200, historyAfterChange.body);
    const changedShift = (parse(historyAfterChange).items as Json[]).find(
      (item) => item.id === parse(second).shift.id,
    );
    assert.equal((changedShift?.segments as Json[]).length, 2);

    const current = await request('GET', '/api/guard/shifts/current', undefined, secondGuardToken);
    assert.equal(parse(current).accessPoint.id, accessPointBId);

    const oldPlace = await request(
      'GET',
      `/api/bitacora?communityId=${communityId}&accessPointId=${accessPointAId}`,
      undefined,
      communityAdminToken,
    );
    assert.equal(oldPlace.statusCode, 200, oldPlace.body);
    assert.equal(
      (parse(oldPlace).items as Json[]).some(
        (entry) => entry.type === 'shift_end' && (entry.details as Json).reason === 'reassigned',
      ),
      true,
    );

    const newPlace = await request(
      'GET',
      `/api/bitacora?communityId=${communityId}&accessPointId=${accessPointBId}`,
      undefined,
      communityAdminToken,
    );
    assert.equal(newPlace.statusCode, 200, newPlace.body);
    assert.equal(
      (parse(newPlace).items as Json[]).some(
        (entry) => entry.type === 'shift_start' && (entry.details as Json).reason === 'reassigned',
      ),
      true,
    );

    await request('POST', `/api/guard/shifts/${parse(second).shift.id}/end`, {}, secondGuardToken);
    await request('POST', `/api/guard/shifts/${parse(first).shift.id}/end`, {}, guardToken);
  });

  it('force-closes a shift as a community admin', async () => {
    const started = await startShift(guardToken, accessPointAId);
    assert.equal(started.statusCode, 201, started.body);
    const shiftId = parse(started).shift.id as string;

    const forced = await request(
      'POST',
      `/api/guard/shifts/${shiftId}/force-close`,
      { reason: 'Guardia reasignado por el administrador' },
      communityAdminToken,
    );
    assert.equal(forced.statusCode, 200, forced.body);
    assert.equal(parse(forced).shift.status, 'closed');

    const current = await request('GET', '/api/guard/shifts/current', undefined, guardToken);
    assert.equal(parse(current).shift, null);

    const entries = await request(
      'GET',
      `/api/bitacora?communityId=${communityId}&accessPointId=${accessPointAId}`,
      undefined,
      communityAdminToken,
    );
    assert.equal(
      (parse(entries).items as Json[]).some(
        (entry) => entry.type === 'shift_end' && entry.source === 'dashboard',
      ),
      true,
    );
  });

  it('creates manual entries and comments, and masks documents in lists', async () => {
    const shift = await startShift(guardToken, accessPointAId);
    assert.equal(shift.statusCode, 201, shift.body);

    const created = await request(
      'POST',
      '/api/bitacora',
      {
        accessPointId: accessPointAId,
        summary: 'Paquete para A-101',
        details: {
          visitor: { firstName: 'Visitante', lastName: 'Manual', document: '12345678' },
          note: 'Entregado en portería',
        },
      },
      guardToken,
    );
    assert.equal(created.statusCode, 201, created.body);
    const entryId = parse(created).id as string;

    const list = await request(
      'GET',
      `/api/bitacora?communityId=${communityId}&accessPointId=${accessPointAId}`,
      undefined,
      communityAdminToken,
    );
    assert.equal(list.statusCode, 200, list.body);
    const listed = (parse(list).items as Json[]).find((item) => item.id === entryId);
    assert.ok(listed);
    assert.equal(listed.details.visitor.document, '***5678');
    assert.equal(listed.authorName, 'Guardia Turno');
    assert.equal(listed.commentCount, 0);

    const detail = await request('GET', `/api/bitacora/${entryId}`, undefined, communityAdminToken);
    assert.equal(detail.statusCode, 200, detail.body);
    const detailBody = parse(detail);
    assert.equal(detailBody.details.visitor.document, '12345678');
    assert.deepEqual(detailBody.comments, []);

    const comment = await request(
      'POST',
      `/api/bitacora/${entryId}/comments`,
      { body: 'Recibido por el residente' },
      guardToken,
    );
    assert.equal(comment.statusCode, 201, comment.body);
    assert.equal(parse(comment).body, 'Recibido por el residente');

    const detailWithComment = await request(
      'GET',
      `/api/bitacora/${entryId}`,
      undefined,
      communityAdminToken,
    );
    assert.equal((parse(detailWithComment).comments as Json[]).length, 1);

    const operatorList = await request('GET', '/api/bitacora', undefined, operatorToken);
    assert.equal(operatorList.statusCode, 403, operatorList.body);

    const residentList = await request('GET', '/api/bitacora', undefined, residentToken);
    assert.equal(residentList.statusCode, 403, residentList.body);

    const guardList = await request('GET', '/api/bitacora', undefined, guardToken);
    assert.equal(guardList.statusCode, 200, guardList.body);
    assert.equal(
      (parse(guardList).items as Json[]).some((item) => item.id === entryId),
      true,
    );

    await request('POST', `/api/guard/shifts/${parse(shift).shift.id}/end`, {}, guardToken);
  });

  it('rejects direct updates to bitacora entries', async () => {
    const created = await request(
      'POST',
      '/api/bitacora',
      {
        accessPointId: accessPointAId,
        summary: 'Entrada inmutable',
        details: { note: 'No se puede editar' },
      },
      communityAdminToken,
    );
    assert.equal(created.statusCode, 201, created.body);
    const entryId = parse(created).id as string;

    await assert.rejects(
      db
        .update(bitacoraEntries)
        .set({ summary: 'Intento de edición' })
        .where(eq(bitacoraEntries.id, entryId)),
      /immutable/i,
    );
  });

  it('requires an active shift to scan and blocks operators and residents', async () => {
    const noShiftScan = await request(
      'POST',
      '/api/access/scan',
      { token: 'not-a-real-token' },
      idleGuardToken,
    );
    assert.equal(noShiftScan.statusCode, 409, noShiftScan.body);
    assert.equal(parse(noShiftScan).message, 'no_active_shift');

    const operatorScan = await request(
      'POST',
      '/api/access/scan',
      { token: 'not-a-real-token' },
      operatorToken,
    );
    assert.equal(operatorScan.statusCode, 403, operatorScan.body);

    const residentShift = await request(
      'GET',
      '/api/guard/shifts/current',
      undefined,
      residentToken,
    );
    assert.equal(residentShift.statusCode, 403, residentShift.body);
  });

  it('keeps the guard shift membership bound to the default access point', async () => {
    const [membership] = await db
      .select()
      .from(memberships)
      .where(eq(memberships.id, guardMembershipId))
      .limit(1);
    assert.ok(membership);
    assert.equal(membership.defaultAccessPointId, accessPointAId);
  });

  it('validates access point selection when starting or changing a shift', async () => {
    const missing = await startShift(idleGuardToken);
    assert.equal(missing.statusCode, 400, missing.body);
    assert.equal(parse(missing).message, 'invalid');

    const started = await startShift(guardToken, accessPointAId);
    assert.equal(started.statusCode, 201, started.body);
    const shiftId = parse(started).shift.id as string;

    const [inactive] = await db
      .insert(accessPoints)
      .values({
        communityId,
        name: `Portón inactivo ${randomUUID().slice(0, 6)}`,
        type: 'gate',
        direction: 'both',
        active: false,
      })
      .returning();

    const inactiveChange = await request(
      'POST',
      `/api/guard/shifts/${shiftId}/change-access-point`,
      { accessPointId: inactive.id },
      guardToken,
    );
    assert.equal(inactiveChange.statusCode, 400, inactiveChange.body);
    assert.equal(parse(inactiveChange).message, 'invalid');

    const [foreignCommunity] = await db
      .insert(communities)
      .values({
        organizationId,
        name: `Foreign Shift Community ${randomUUID().slice(0, 6)}`,
        slug: `foreign-shift-community-${randomUUID().slice(0, 8)}`,
        address: 'Calle Externa 1',
        timezone: 'UTC',
      })
      .returning();
    const [foreignAccessPoint] = await db
      .insert(accessPoints)
      .values({
        communityId: foreignCommunity.id,
        name: 'Portón externo',
        type: 'gate',
        direction: 'both',
        active: true,
      })
      .returning();

    const foreignChange = await request(
      'POST',
      `/api/guard/shifts/${shiftId}/change-access-point`,
      { accessPointId: foreignAccessPoint.id },
      guardToken,
    );
    assert.equal(foreignChange.statusCode, 403, foreignChange.body);
    assert.equal(parse(foreignChange).message, 'forbidden');

    await request('POST', `/api/guard/shifts/${shiftId}/end`, {}, guardToken);
    await db.delete(accessPoints).where(eq(accessPoints.id, inactive.id));
    await db.delete(communities).where(eq(communities.id, foreignCommunity.id));
  });

  it('marks a shift as stale after the configured maximum duration', async () => {
    const started = await startShift(guardToken, accessPointAId);
    assert.equal(started.statusCode, 201, started.body);
    const shiftId = parse(started).shift.id as string;

    await db
      .update(guardShifts)
      .set({ startedAt: new Date(Date.now() - 20 * 60 * 60 * 1000) })
      .where(eq(guardShifts.id, shiftId));

    const current = await request('GET', '/api/guard/shifts/current', undefined, guardToken);
    assert.equal(current.statusCode, 200, current.body);
    assert.equal(parse(current).stale, true);

    await request('POST', `/api/guard/shifts/${shiftId}/end`, {}, guardToken);
  });
});
