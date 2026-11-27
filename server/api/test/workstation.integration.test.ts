import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { and, eq, inArray } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';

process.env.OUTBOX_WORKER_ENABLED = 'false';

import { createDb } from '@porteria/database';
import {
  accessPoints,
  accounts,
  bitacoraEntries,
  communities,
  events,
  guardShifts,
  memberships,
  organizations,
  people,
} from '@porteria/database/schema';

const db = createDb();

let app: FastifyInstance;
let organizationId: string;
let communityId: string;
let otherCommunityId: string;
let accessPointAId: string;
let accessPointBId: string;
let inactiveAccessPointId: string;
let foreignAccessPointId: string;
let guardPersonId: string;
let guardAccountId: string;
let guardMembershipId: string;
let guardToken: string;
let secondGuardPersonId: string;
let secondGuardAccountId: string;
let secondGuardMembershipId: string;
let secondGuardToken: string;
let communityAdminAccountId: string;
let communityAdminPersonId: string;
let communityAdminMembershipId: string;
let communityAdminToken: string;
let otherCommunityAdminToken: string;
let orgAdminToken: string;
let operatorToken: string;
let residentMembershipId: string;
let platformAdminToken: string;
let otherCommunityAdminMembershipId: string;
let orgAdminMembershipId: string;
let operatorMembershipId: string;
let personIds: string[] = [];

type Json = Record<string, any>;

function auth(token: string) {
  return { authorization: `Bearer ${token}` };
}

async function request(
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
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

async function assign(token: string, membershipId: string, accessPointId: string | null) {
  return request('PUT', `/api/memberships/${membershipId}/workstation`, { accessPointId }, token);
}

describe('guard workstation assignment integration', () => {
  before(async () => {
    const suffix = randomUUID().slice(0, 8);

    const [organization] = await db
      .insert(organizations)
      .values({ name: `Workstation Org ${suffix}`, slug: `workstation-org-${suffix}` })
      .returning();
    organizationId = organization.id;

    const [community] = await db
      .insert(communities)
      .values({
        organizationId,
        name: `Workstation Community ${suffix}`,
        slug: `workstation-community-${suffix}`,
        address: 'Calle Puestos 123',
        timezone: 'UTC',
      })
      .returning();
    communityId = community.id;

    const [otherCommunity] = await db
      .insert(communities)
      .values({
        organizationId,
        name: `Workstation Other ${suffix}`,
        slug: `workstation-other-${suffix}`,
        address: 'Calle Puestos 456',
        timezone: 'UTC',
      })
      .returning();
    otherCommunityId = otherCommunity.id;

    const [pointA, pointB, pointInactive, pointForeign] = await db
      .insert(accessPoints)
      .values([
        { communityId, name: `Portón A ${suffix}`, type: 'gate', direction: 'both', active: true },
        { communityId, name: `Portón B ${suffix}`, type: 'gate', direction: 'entry', active: true },
        {
          communityId,
          name: `Portón Cerrado ${suffix}`,
          type: 'door',
          direction: 'both',
          active: false,
        },
        {
          communityId: otherCommunityId,
          name: `Portón Ajeno ${suffix}`,
          type: 'gate',
          direction: 'both',
          active: true,
        },
      ])
      .returning();
    accessPointAId = pointA.id;
    accessPointBId = pointB.id;
    inactiveAccessPointId = pointInactive.id;
    foreignAccessPointId = pointForeign.id;

    const [guard, secondGuard, communityAdmin, otherCommunityAdmin, orgAdmin, operator, resident] =
      await db
        .insert(people)
        .values([
          { firstName: 'Guardia', lastName: 'Puesto', status: 'active' },
          { firstName: 'Guardia', lastName: 'Segundo', status: 'active' },
          { firstName: 'Admin', lastName: 'Comunidad', status: 'active' },
          { firstName: 'Admin', lastName: 'Otra', status: 'active' },
          { firstName: 'Admin', lastName: 'Organizacion', status: 'active' },
          { firstName: 'Operador', lastName: 'Puesto', status: 'active' },
          { firstName: 'Residente', lastName: 'Puesto', status: 'active' },
        ])
        .returning();
    guardPersonId = guard.id;
    secondGuardPersonId = secondGuard.id;
    communityAdminPersonId = communityAdmin.id;
    personIds = [
      guard.id,
      secondGuard.id,
      communityAdmin.id,
      otherCommunityAdmin.id,
      orgAdmin.id,
      operator.id,
      resident.id,
    ];

    const createdAccounts = await db
      .insert(accounts)
      .values([
        { personId: guard.id, email: `ws-guard-${suffix}@test.local`, passwordHash: 'x' },
        { personId: secondGuard.id, email: `ws-guard2-${suffix}@test.local`, passwordHash: 'x' },
        {
          personId: communityAdmin.id,
          email: `ws-community-admin-${suffix}@test.local`,
          passwordHash: 'x',
        },
        {
          personId: otherCommunityAdmin.id,
          email: `ws-other-admin-${suffix}@test.local`,
          passwordHash: 'x',
        },
        { personId: orgAdmin.id, email: `ws-org-admin-${suffix}@test.local`, passwordHash: 'x' },
        { personId: operator.id, email: `ws-operator-${suffix}@test.local`, passwordHash: 'x' },
        { personId: resident.id, email: `ws-resident-${suffix}@test.local`, passwordHash: 'x' },
      ])
      .returning();
    guardAccountId = createdAccounts[0].id;
    secondGuardAccountId = createdAccounts[1].id;
    communityAdminAccountId = createdAccounts[2].id;

    // El platform admin se reconoce por la cuenta, no por el token: se crea uno
    // real para que el guardarraíl de tenant read-only sea el que responda.
    const [platformPerson] = await db
      .insert(people)
      .values({ firstName: 'Super', lastName: 'Admin', status: 'active' })
      .returning();
    const [platformAccount] = await db
      .insert(accounts)
      .values({
        personId: platformPerson.id,
        email: `ws-platform-${suffix}@test.local`,
        passwordHash: 'x',
        isPlatformAdmin: true,
      })
      .returning();
    personIds.push(platformPerson.id);

    const [guardMembership] = await db
      .insert(memberships)
      .values({
        personId: guardPersonId,
        organizationId,
        communityId,
        role: 'guard',
        status: 'active',
      })
      .returning();
    guardMembershipId = guardMembership.id;

    const [secondGuardMembership] = await db
      .insert(memberships)
      .values({
        personId: secondGuardPersonId,
        organizationId,
        communityId,
        role: 'guard',
        status: 'active',
      })
      .returning();
    secondGuardMembershipId = secondGuardMembership.id;

    const [communityAdminMembership] = await db
      .insert(memberships)
      .values({
        personId: communityAdminPersonId,
        organizationId,
        communityId,
        role: 'community_admin',
        status: 'active',
      })
      .returning();
    communityAdminMembershipId = communityAdminMembership.id;

    const extraMemberships = await db
      .insert(memberships)
      .values([
        {
          personId: otherCommunityAdmin.id,
          organizationId,
          communityId: otherCommunityId,
          role: 'community_admin',
          status: 'active',
        },
        {
          personId: orgAdmin.id,
          organizationId,
          role: 'org_admin',
          status: 'active',
        },
        {
          personId: operator.id,
          organizationId,
          communityId,
          role: 'operator',
          status: 'active',
        },
        {
          personId: resident.id,
          organizationId,
          communityId,
          role: 'resident',
          status: 'active',
        },
      ])
      .returning();

    otherCommunityAdminMembershipId = extraMemberships[0].id;
    orgAdminMembershipId = extraMemberships[1].id;
    operatorMembershipId = extraMemberships[2].id;
    residentMembershipId = extraMemberships[3].id;

    const { buildApp } = await import('../src/index.js');
    app = (await buildApp()).app;

    const base = {
      email: `ws-${suffix}@test.local`,
      orgId: organizationId,
      unitId: null,
      isPlatformAdmin: false,
    };

    guardToken = app.jwt.sign({
      ...base,
      sub: guardAccountId,
      accountId: guardAccountId,
      personId: guardPersonId,
      membershipId: guardMembershipId,
      role: 'guard',
      communityId,
    });
    secondGuardToken = app.jwt.sign({
      ...base,
      sub: secondGuardAccountId,
      accountId: secondGuardAccountId,
      personId: secondGuardPersonId,
      membershipId: secondGuardMembershipId,
      role: 'guard',
      communityId,
    });
    communityAdminToken = app.jwt.sign({
      ...base,
      sub: communityAdminAccountId,
      accountId: communityAdminAccountId,
      personId: communityAdminPersonId,
      membershipId: communityAdminMembershipId,
      role: 'community_admin',
      communityId,
    });
    otherCommunityAdminToken = app.jwt.sign({
      ...base,
      sub: createdAccounts[3].id,
      accountId: createdAccounts[3].id,
      personId: otherCommunityAdmin.id,
      membershipId: otherCommunityAdminMembershipId,
      role: 'community_admin',
      communityId: otherCommunityId,
    });
    orgAdminToken = app.jwt.sign({
      ...base,
      sub: createdAccounts[4].id,
      accountId: createdAccounts[4].id,
      personId: orgAdmin.id,
      membershipId: orgAdminMembershipId,
      role: 'org_admin',
      communityId: null,
    });
    operatorToken = app.jwt.sign({
      ...base,
      sub: createdAccounts[5].id,
      accountId: createdAccounts[5].id,
      personId: operator.id,
      membershipId: operatorMembershipId,
      role: 'operator',
      communityId,
    });
    platformAdminToken = app.jwt.sign({
      ...base,
      isPlatformAdmin: true,
      sub: platformAccount.id,
      accountId: platformAccount.id,
      personId: platformPerson.id,
      membershipId: 'platform',
      role: 'staff',
      communityId: null,
    });
  });

  after(async () => {
    // La bitácora tiene un trigger que prohíbe updates: se borra antes de los
    // turnos, que la referencian con `shift_id`.
    await db.delete(bitacoraEntries).where(eq(bitacoraEntries.communityId, communityId));
    await db.delete(guardShifts).where(eq(guardShifts.communityId, communityId));
    await db.delete(memberships).where(eq(memberships.organizationId, organizationId));
    await db.delete(accessPoints).where(eq(accessPoints.communityId, communityId));
    await db.delete(accessPoints).where(eq(accessPoints.communityId, otherCommunityId));
    await db.delete(events).where(eq(events.organizationId, organizationId));
    await db.delete(communities).where(eq(communities.organizationId, organizationId));
    await db.delete(people).where(inArray(people.id, personIds));
    await db.delete(organizations).where(eq(organizations.id, organizationId));
    await app.close();
  });

  it('assigns, replaces, reads and clears a workstation', async () => {
    const assigned = await assign(communityAdminToken, guardMembershipId, accessPointAId);
    assert.equal(assigned.statusCode, 200, assigned.body);
    const assignedBody = parse(assigned);
    assert.equal(assignedBody.accessPointId, accessPointAId);
    assert.equal(assignedBody.active, true);

    const replaced = await assign(communityAdminToken, guardMembershipId, accessPointBId);
    assert.equal(replaced.statusCode, 200, replaced.body);
    assert.equal(parse(replaced).accessPointId, accessPointBId);

    const own = await request('GET', '/api/me/workstation', undefined, guardToken);
    assert.equal(own.statusCode, 200, own.body);
    assert.equal(parse(own).accessPointId, accessPointBId);

    const cleared = await assign(communityAdminToken, guardMembershipId, null);
    assert.equal(cleared.statusCode, 200, cleared.body);
    assert.equal(parse(cleared).accessPointId, null);

    const again = await assign(communityAdminToken, guardMembershipId, null);
    assert.equal(again.statusCode, 200, again.body);
    assert.equal(parse(again).accessPointId, null);

    const ownAfter = await request('GET', '/api/me/workstation', undefined, guardToken);
    assert.equal(parse(ownAfter).accessPointId, null);
  });

  it('returns the most specific restriction', async () => {
    const resident = await assign(communityAdminToken, residentMembershipId, accessPointAId);
    assert.equal(resident.statusCode, 400, resident.body);
    assert.equal(parse(resident).code, 'role_not_guard');

    const operator = await assign(operatorToken, guardMembershipId, accessPointAId);
    assert.equal(operator.statusCode, 403, operator.body);

    const platform = await assign(platformAdminToken, guardMembershipId, accessPointAId);
    assert.equal(platform.statusCode, 403, platform.body);
    // El platform admin no tiene contexto de tenant: la capa de guardarraíles lo
    // rechaza antes de llegar al servicio (por eso el mensaje no trae `code`).
    assert.match(platform.body, /comunidad|community|read-only/);
    const afterPlatform = await request('GET', '/api/me/workstation', undefined, guardToken);
    assert.notEqual(parse(afterPlatform).accessPointId, accessPointAId);

    const foreign = await assign(otherCommunityAdminToken, guardMembershipId, accessPointAId);
    assert.equal(foreign.statusCode, 404, foreign.body);

    const inactive = await assign(communityAdminToken, guardMembershipId, inactiveAccessPointId);
    assert.equal(inactive.statusCode, 400, inactive.body);
    assert.equal(parse(inactive).code, 'access_point_inactive');

    const otherCommunityPoint = await assign(
      communityAdminToken,
      guardMembershipId,
      foreignAccessPointId,
    );
    assert.equal(otherCommunityPoint.statusCode, 404, otherCommunityPoint.body);

    const missing = await assign(
      communityAdminToken,
      '00000000-0000-0000-0000-000000000000',
      accessPointAId,
    );
    assert.equal(missing.statusCode, 404, missing.body);
  });

  it('does not move an open shift when the workstation changes', async () => {
    await assign(communityAdminToken, guardMembershipId, accessPointAId);

    const started = await request(
      'POST',
      '/api/guard/shifts/start',
      { accessPointId: accessPointAId },
      guardToken,
    );
    assert.equal(started.statusCode, 201, started.body);

    const changed = await assign(communityAdminToken, guardMembershipId, accessPointBId);
    assert.equal(changed.statusCode, 200, changed.body);
    const body = parse(changed);
    assert.equal(body.appliesNextShift, true);
    assert.equal(body.activeShiftAccessPointId, accessPointAId);

    const current = await request('GET', '/api/guard/shifts/current', undefined, guardToken);
    assert.equal(current.statusCode, 200, current.body);
    assert.equal(parse(current).accessPoint.id, accessPointAId);

    const shiftId = parse(started).shift.id;
    const ended = await request('POST', `/api/guard/shifts/${shiftId}/end`, {}, guardToken);
    assert.ok([200, 204].includes(ended.statusCode), ended.body);
  });

  it('lists assigned guards and counts them in the access point list', async () => {
    await assign(communityAdminToken, guardMembershipId, accessPointAId);
    await assign(communityAdminToken, secondGuardMembershipId, accessPointAId);

    const guards = await request(
      'GET',
      `/api/communities/${communityId}/access-points/${accessPointAId}/guards`,
      undefined,
      communityAdminToken,
    );
    assert.equal(guards.statusCode, 200, guards.body);
    const items = parse(guards).items as Json[];
    assert.equal(items.length, 2);
    assert.equal(
      items.every((item) => item.onShift === false),
      true,
    );

    const list = await request(
      'GET',
      `/api/communities/${communityId}/access-points?includeInactive=true`,
      undefined,
      communityAdminToken,
    );
    assert.equal(list.statusCode, 200, list.body);
    const pointA = (parse(list).items as Json[]).find((item) => item.id === accessPointAId);
    assert.equal(pointA?.assignedGuards, 2);

    await assign(communityAdminToken, secondGuardMembershipId, null);
  });

  it('keeps the assignment when the access point is deactivated', async () => {
    await assign(communityAdminToken, guardMembershipId, accessPointAId);

    const deactivated = await request(
      'DELETE',
      `/api/communities/${communityId}/access-points/${accessPointAId}`,
      undefined,
      communityAdminToken,
    );
    assert.equal(deactivated.statusCode, 200, deactivated.body);

    const own = await request('GET', '/api/me/workstation', undefined, guardToken);
    assert.equal(own.statusCode, 200, own.body);
    const body = parse(own);
    assert.equal(body.accessPointId, accessPointAId);
    assert.equal(body.active, false);

    const reactivated = await request(
      'PATCH',
      `/api/communities/${communityId}/access-points/${accessPointAId}`,
      { active: true },
      communityAdminToken,
    );
    assert.equal(reactivated.statusCode, 200, reactivated.body);
  });

  it('audits assignments through the membership patch too', async () => {
    await assign(communityAdminToken, guardMembershipId, null);

    const patched = await request(
      'PATCH',
      `/api/memberships/${guardMembershipId}`,
      { defaultAccessPointId: accessPointBId },
      orgAdminToken,
    );
    assert.equal(patched.statusCode, 200, patched.body);
    assert.equal(parse(patched).defaultAccessPointId, accessPointBId);

    const rows = await db
      .select({ id: events.id, metadata: events.metadata })
      .from(events)
      .where(
        and(
          eq(events.organizationId, organizationId),
          eq(events.eventType, 'admin.workstation.assigned'),
        ),
      );
    const matching = rows.filter(
      (row) => (row.metadata as Json | null)?.membershipId === guardMembershipId,
    );
    assert.ok(matching.length >= 1, 'expected an admin.workstation.assigned event');
    const last = matching[matching.length - 1].metadata as Json;
    assert.equal(last.accessPointId, accessPointBId);
    assert.equal(last.previousAccessPointId, null);
  });

  it('lets a guard start a shift outside the assigned workstation', async () => {
    await assign(communityAdminToken, guardMembershipId, accessPointAId);

    const started = await request(
      'POST',
      '/api/guard/shifts/start',
      { accessPointId: accessPointBId },
      secondGuardToken,
    );
    assert.equal(started.statusCode, 201, started.body);
    const startedBody = parse(started);
    assert.equal(startedBody.accessPoint.id, accessPointBId);

    const own = await request('GET', '/api/me/workstation', undefined, guardToken);
    assert.equal(parse(own).accessPointId, accessPointAId);

    const ended = await request(
      'POST',
      `/api/guard/shifts/${startedBody.shift.id}/end`,
      {},
      secondGuardToken,
    );
    assert.ok([200, 204].includes(ended.statusCode), ended.body);
  });

  it('clears the workstation when the membership stops being a guard', async () => {
    await assign(communityAdminToken, guardMembershipId, accessPointAId);

    const patched = await request(
      'PATCH',
      `/api/memberships/${guardMembershipId}`,
      { role: 'operator' },
      orgAdminToken,
    );
    assert.equal(patched.statusCode, 200, patched.body);
    assert.equal(parse(patched).defaultAccessPointId, null);

    const restored = await request(
      'PATCH',
      `/api/memberships/${guardMembershipId}`,
      { role: 'guard' },
      orgAdminToken,
    );
    assert.equal(restored.statusCode, 200, restored.body);
  });
});
