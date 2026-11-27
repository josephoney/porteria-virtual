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
import { deleteMembership } from '../src/services/memberships.service.js';

const db = createDb();

let app: FastifyInstance;
let organizationId: string;
let communityId: string;
let otherCommunityId: string;
let orgAdminToken: string;
let orgAdminMembershipId: string;
let communityAdminToken: string;
let communityAdminMembershipId: string;
let guardToken: string;
let guardMembershipId: string;
let guardPersonId: string;
let residentMembershipId: string;
let residentPersonId: string;
let secondOrgAdminMembershipId: string;
let otherCommunityAdminToken: string;
let otherCommunityMembershipId: string;
let extraCommunityAdminMembershipId: string;
let personIds: string[] = [];

type Json = Record<string, any>;

async function request(
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  url: string,
  payload?: unknown,
  token?: string | null,
) {
  return app.inject({
    method,
    url,
    headers: token ? { authorization: `Bearer ${token}` } : undefined,
    payload: payload as Record<string, unknown> | undefined,
  });
}

function parse(response: { body: string }) {
  return JSON.parse(response.body) as Json;
}

describe('membership removal integration', () => {
  before(async () => {
    const suffix = randomUUID().slice(0, 8);

    const [organization] = await db
      .insert(organizations)
      .values({ name: `Removal Org ${suffix}`, slug: `removal-org-${suffix}` })
      .returning();
    organizationId = organization.id;

    const [community] = await db
      .insert(communities)
      .values({
        organizationId,
        name: `Removal Community ${suffix}`,
        slug: `removal-community-${suffix}`,
        address: 'Calle Borrado 1',
        timezone: 'UTC',
      })
      .returning();
    communityId = community.id;

    const [otherCommunity] = await db
      .insert(communities)
      .values({
        organizationId,
        name: `Removal Other ${suffix}`,
        slug: `removal-other-${suffix}`,
        address: 'Calle Borrado 2',
        timezone: 'UTC',
      })
      .returning();
    otherCommunityId = otherCommunity.id;

    const [accessPoint] = await db
      .insert(accessPoints)
      .values({
        communityId,
        name: `Portón Borrado ${suffix}`,
        type: 'gate',
        direction: 'both',
        active: true,
      })
      .returning();

    const peopleRows = await db
      .insert(people)
      .values([
        { firstName: 'Admin', lastName: 'Organizacion', status: 'active' },
        { firstName: 'Admin', lastName: 'Dos', status: 'active' },
        { firstName: 'Admin', lastName: 'Comunidad', status: 'active' },
        { firstName: 'Admin', lastName: 'Otra', status: 'active' },
        { firstName: 'Guardia', lastName: 'Borrado', status: 'active' },
        { firstName: 'Residente', lastName: 'Borrado', status: 'active' },
      ])
      .returning();

    personIds = peopleRows.map((row) => row.id);
    const [orgAdminPerson, secondOrgAdminPerson, communityAdminPerson, otherAdminPerson] =
      peopleRows;
    guardPersonId = peopleRows[4].id;
    residentPersonId = peopleRows[5].id;

    const accountRows = await db
      .insert(accounts)
      .values([
        { personId: orgAdminPerson.id, email: `rm-orgadmin-${suffix}@test.local`, passwordHash: 'x' },
        {
          personId: secondOrgAdminPerson.id,
          email: `rm-orgadmin2-${suffix}@test.local`,
          passwordHash: 'x',
        },
        { personId: communityAdminPerson.id, email: `rm-community-${suffix}@test.local`, passwordHash: 'x' },
        { personId: otherAdminPerson.id, email: `rm-other-${suffix}@test.local`, passwordHash: 'x' },
        { personId: guardPersonId, email: `rm-guard-${suffix}@test.local`, passwordHash: 'x' },
        { personId: residentPersonId, email: `rm-resident-${suffix}@test.local`, passwordHash: 'x' },
      ])
      .returning();

    const membershipRows = await db
      .insert(memberships)
      .values([
        { personId: orgAdminPerson.id, organizationId, role: 'org_admin', status: 'active' },
        { personId: secondOrgAdminPerson.id, organizationId, role: 'org_admin', status: 'active' },
        {
          personId: communityAdminPerson.id,
          organizationId,
          communityId,
          role: 'community_admin',
          status: 'active',
        },
        {
          personId: otherAdminPerson.id,
          organizationId,
          communityId: otherCommunityId,
          role: 'community_admin',
          status: 'active',
        },
        {
          personId: guardPersonId,
          organizationId,
          communityId,
          role: 'guard',
          status: 'active',
          defaultAccessPointId: accessPoint.id,
        },
        {
          personId: residentPersonId,
          organizationId,
          communityId,
          role: 'resident',
          status: 'inactive',
        },
        {
          // Misma comunidad, rol que un community_admin no puede tocar.
          personId: otherAdminPerson.id,
          organizationId,
          communityId,
          role: 'community_admin',
          status: 'active',
        },
      ])
      .returning();

    orgAdminMembershipId = membershipRows[0].id;
    secondOrgAdminMembershipId = membershipRows[1].id;
    communityAdminMembershipId = membershipRows[2].id;
    otherCommunityMembershipId = membershipRows[3].id;
    guardMembershipId = membershipRows[4].id;
    residentMembershipId = membershipRows[5].id;
    extraCommunityAdminMembershipId = membershipRows[6].id;

    const { buildApp } = await import('../src/index.js');
    app = (await buildApp()).app;

    const base = {
      email: `rm-${suffix}@test.local`,
      orgId: organizationId,
      unitId: null,
      isPlatformAdmin: false,
    };

    orgAdminToken = app.jwt.sign({
      ...base,
      sub: accountRows[0].id,
      accountId: accountRows[0].id,
      personId: orgAdminPerson.id,
      membershipId: orgAdminMembershipId,
      role: 'org_admin',
      communityId: null,
    });
    communityAdminToken = app.jwt.sign({
      ...base,
      sub: accountRows[2].id,
      accountId: accountRows[2].id,
      personId: communityAdminPerson.id,
      membershipId: communityAdminMembershipId,
      role: 'community_admin',
      communityId,
    });
    otherCommunityAdminToken = app.jwt.sign({
      ...base,
      sub: accountRows[3].id,
      accountId: accountRows[3].id,
      personId: otherAdminPerson.id,
      membershipId: otherCommunityMembershipId,
      role: 'community_admin',
      communityId: otherCommunityId,
    });
    guardToken = app.jwt.sign({
      ...base,
      sub: accountRows[4].id,
      accountId: accountRows[4].id,
      personId: guardPersonId,
      membershipId: guardMembershipId,
      role: 'guard',
      communityId,
    });
  });

  after(async () => {
    // La bitácora es inmutable: se borra antes de los turnos, que la referencian.
    await db.delete(bitacoraEntries).where(eq(bitacoraEntries.communityId, communityId));
    await db.delete(guardShifts).where(eq(guardShifts.communityId, communityId));
    await db.delete(memberships).where(eq(memberships.organizationId, organizationId));
    await db.delete(events).where(eq(events.organizationId, organizationId));
    await db.delete(accessPoints).where(eq(accessPoints.communityId, communityId));
    await db.delete(communities).where(eq(communities.organizationId, organizationId));
    await db.delete(people).where(inArray(people.id, personIds));
    await db.delete(organizations).where(eq(organizations.id, organizationId));
    await app.close();
  });

  it('deletes an inactive membership and keeps the person', async () => {
    const response = await request(
      'DELETE',
      `/api/memberships/${residentMembershipId}`,
      undefined,
      communityAdminToken,
    );
    assert.equal(response.statusCode, 200, response.body);
    assert.deepEqual(parse(response), { deleted: true });

    const [row] = await db
      .select({ id: memberships.id })
      .from(memberships)
      .where(eq(memberships.id, residentMembershipId));
    assert.equal(row, undefined, 'the membership must be gone');

    const [person] = await db
      .select({ id: people.id })
      .from(people)
      .where(eq(people.id, residentPersonId));
    assert.ok(person, 'the person must survive');

    const [audit] = await db
      .select({ metadata: events.metadata })
      .from(events)
      .where(
        and(eq(events.organizationId, organizationId), eq(events.eventType, 'membership.deleted')),
      );
    assert.equal((audit.metadata as Json).membershipId, residentMembershipId);
    assert.equal((audit.metadata as Json).previousStatus, 'inactive');
  });

  it('refuses a membership from another community', async () => {
    const response = await request(
      'DELETE',
      `/api/memberships/${otherCommunityMembershipId}`,
      undefined,
      communityAdminToken,
    );
    assert.equal(response.statusCode, 404, response.body);
  });

  it('refuses a role outside the policy of a community admin', async () => {
    const response = await request(
      'DELETE',
      `/api/memberships/${extraCommunityAdminMembershipId}`,
      undefined,
      communityAdminToken,
    );
    assert.equal(response.statusCode, 403, response.body);
    assert.equal(parse(response).code, 'Role out of scope');
  });

  it('refuses deleting the own active context', async () => {
    const response = await request(
      'DELETE',
      `/api/memberships/${orgAdminMembershipId}`,
      undefined,
      orgAdminToken,
    );
    assert.equal(response.statusCode, 409, response.body);
    assert.equal(parse(response).code, 'own_active_membership');
  });

  it('refuses deleting a membership with an open shift, then allows it', async () => {
    const started = await request('POST', '/api/guard/shifts/start', {}, guardToken);
    assert.equal(started.statusCode, 201, started.body);

    const blocked = await request(
      'DELETE',
      `/api/memberships/${guardMembershipId}`,
      undefined,
      orgAdminToken,
    );
    assert.equal(blocked.statusCode, 409, blocked.body);
    assert.equal(parse(blocked).code, 'open_shift');

    const shiftId = parse(started).shift.id;
    const ended = await request('POST', `/api/guard/shifts/${shiftId}/end`, {}, guardToken);
    assert.ok([200, 204].includes(ended.statusCode), ended.body);

    const deleted = await request(
      'DELETE',
      `/api/memberships/${guardMembershipId}`,
      undefined,
      orgAdminToken,
    );
    assert.equal(deleted.statusCode, 200, deleted.body);
  });

  it('refuses the platform admin', async () => {
    const result = await deleteMembership(secondOrgAdminMembershipId, {
      sub: 'platform-account',
      role: 'staff',
      orgId: organizationId,
      communityId: null,
      isPlatformAdmin: true,
    });
    assert.deepEqual(result, { error: 'tenant_read_only' });
  });

  it('refuses deleting the last active org admin', async () => {
    await db
      .update(memberships)
      .set({ status: 'inactive' })
      .where(eq(memberships.id, orgAdminMembershipId));

    const result = await deleteMembership(secondOrgAdminMembershipId, {
      sub: 'actor-without-active-membership',
      membershipId: orgAdminMembershipId,
      role: 'org_admin',
      orgId: organizationId,
      communityId: null,
      isPlatformAdmin: false,
    });
    assert.deepEqual(result, { error: 'last_org_admin' });

    await db
      .update(memberships)
      .set({ status: 'active' })
      .where(eq(memberships.id, orgAdminMembershipId));
  });

  it('returns 404 for an unknown membership', async () => {
    const response = await request(
      'DELETE',
      '/api/memberships/00000000-0000-0000-0000-000000000000',
      undefined,
      otherCommunityAdminToken,
    );
    assert.equal(response.statusCode, 404, response.body);
  });
});
