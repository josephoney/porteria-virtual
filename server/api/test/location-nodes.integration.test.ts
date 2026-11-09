import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { and, eq, inArray } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';

// The app starts the outbox worker from config at import time.
process.env.OUTBOX_WORKER_ENABLED = 'false';

import { createDb } from '@porteria/database';
import {
  accounts,
  communities,
  events,
  locationResidents,
  locationStructures,
  locationUnits,
  memberships,
  organizations,
  people,
  users,
} from '@porteria/database/schema';

const db = createDb();

let app: FastifyInstance;
let token: string;
let organizationId: string;
let communityId: string;
let structureId: string;
let sectionAId: string;
let sectionBId: string;
let floorAId: string;
let floorBId: string;
let unitAId: string;
let unitChildId: string;
let residentUserId: string;
let residentId: string;
let orgAdminUserId: string;
let orgAdminToken: string;
let orgAdminPersonId: string;
let communityAdminUserId: string;
let communityAdminPersonId: string;
let communityAdminToken: string;
let guardUserId: string;
let guardToken: string;
let legalRepresentativePersonId: string;
let legalRepresentativeDocument: string;
let otherStructureId: string;
let otherSectionId: string;
let cycleFloorId: string;
let cycleUnitId: string;

function authHeaders() {
  return { authorization: `Bearer ${token}` };
}

async function request(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  url: string,
  payload?: unknown,
  authToken = orgAdminToken,
) {
  return app.inject({
    method,
    url,
    headers: { authorization: `Bearer ${authToken}` },
    payload: payload as Record<string, unknown> | undefined,
  });
}

describe('location node integration', () => {
  before(async () => {
    const suffix = randomUUID().slice(0, 8);

    const [organization] = await db
      .insert(organizations)
      .values({
        name: `Test Org ${suffix}`,
        slug: `test-org-${suffix}`,
      })
      .returning();
    organizationId = organization.id;

    const [community] = await db
      .insert(communities)
      .values({
        organizationId,
        name: `Test Community ${suffix}`,
        slug: `test-community-${suffix}`,
        address: 'Test address',
        timezone: 'UTC',
      })
      .returning();
    communityId = community.id;

    const [structure] = await db
      .insert(locationStructures)
      .values({
        communityId,
        name: 'Test Structure',
        levelCount: 3,
        level1Name: 'Section',
        level2Name: 'Floor',
        level3Name: 'Unit',
      })
      .returning();
    structureId = structure.id;

    const [sectionA, sectionB] = await db
      .insert(locationUnits)
      .values([
        {
          communityId,
          structureId,
          parentId: null,
          levelPosition: 1,
          name: 'Section A',
          code: `SECTION-A-${suffix}`,
          sectionType: 'tower',
        },
        {
          communityId,
          structureId,
          parentId: null,
          levelPosition: 1,
          name: 'Section B',
          code: `SECTION-B-${suffix}`,
          sectionType: 'tower',
        },
      ])
      .returning();
    sectionAId = sectionA.id;
    sectionBId = sectionB.id;

    const [floorA, floorB] = await db
      .insert(locationUnits)
      .values([
        {
          communityId,
          structureId,
          parentId: sectionAId,
          levelPosition: 2,
          name: 'Floor A',
          code: `FLOOR-A-${suffix}`,
        },
        {
          communityId,
          structureId,
          parentId: sectionBId,
          levelPosition: 2,
          name: 'Floor B',
          code: `FLOOR-B-${suffix}`,
        },
      ])
      .returning();
    floorAId = floorA.id;
    floorBId = floorB.id;

    const [unitA, unitChild] = await db
      .insert(locationUnits)
      .values([
        {
          communityId,
          structureId,
          parentId: floorAId,
          levelPosition: 3,
          name: 'Unit A',
          code: `UNIT-A-${suffix}`,
        },
        {
          communityId,
          structureId,
          parentId: floorAId,
          levelPosition: 3,
          name: 'Unit A Child',
          code: `UNIT-A-CHILD-${suffix}`,
        },
      ])
      .returning();
    unitAId = unitA.id;
    unitChildId = unitChild.id;

    const [otherStructure] = await db
      .insert(locationStructures)
      .values({
        communityId,
        name: 'Other Structure',
        levelCount: 3,
        level1Name: 'Section',
        level2Name: 'Floor',
        level3Name: 'Unit',
      })
      .returning();
    otherStructureId = otherStructure.id;

    const [otherSection] = await db
      .insert(locationUnits)
      .values({
        communityId,
        structureId: otherStructureId,
        parentId: null,
        levelPosition: 1,
        name: 'Other Section',
        code: `OTHER-SECTION-${suffix}`,
        sectionType: 'tower',
      })
      .returning();
    otherSectionId = otherSection.id;

    const [cycleStructure] = await db
      .insert(locationStructures)
      .values({
        communityId,
        name: 'Cycle Test Structure',
        levelCount: 5,
        level1Name: 'Section',
        level2Name: 'Floor',
        level3Name: 'Unit',
      })
      .returning();

    const [cycleSection] = await db
      .insert(locationUnits)
      .values({
        communityId,
        structureId: cycleStructure.id,
        parentId: null,
        levelPosition: 1,
        name: 'Cycle Section',
        code: `CYCLE-SECTION-${suffix}`,
        sectionType: 'tower',
      })
      .returning();

    const [cycleFloor] = await db
      .insert(locationUnits)
      .values({
        communityId,
        structureId: cycleStructure.id,
        parentId: cycleSection.id,
        levelPosition: 2,
        name: 'Cycle Floor',
        code: `CYCLE-FLOOR-${suffix}`,
      })
      .returning();
    cycleFloorId = cycleFloor.id;

    const [cycleUnit] = await db
      .insert(locationUnits)
      .values({
        communityId,
        structureId: cycleStructure.id,
        parentId: cycleFloor.id,
        levelPosition: 3,
        name: 'Cycle Unit',
        code: `CYCLE-UNIT-${suffix}`,
      })
      .returning();
    cycleUnitId = cycleUnit.id;

    const [residentUser] = await db
      .insert(users)
      .values({
        email: `resident-${suffix}@test.local`,
        passwordHash: 'not-used',
        name: 'Resident Test',
      })
      .returning();
    residentUserId = residentUser.id;

    const [resident] = await db
      .insert(locationResidents)
      .values({
        locationUnitId: unitAId,
        userId: residentUserId,
        relationship: 'owner',
        validFrom: new Date().toISOString().slice(0, 10),
        status: 'active',
      })
      .returning();
    residentId = resident.id;

    const [orgAdminUser] = await db
      .insert(users)
      .values({
        email: `org-admin-${suffix}@test.local`,
        passwordHash: 'not-used',
        name: 'Org Admin Test',
      })
      .returning();
    orgAdminUserId = orgAdminUser.id;

    const [legalRepresentative] = await db
      .insert(people)
      .values({
        firstName: 'Legal',
        lastName: 'Representative',
        documentType: 'CC',
        documentNumber: legalRepresentativeDocument = `LEGAL-${suffix}`,
        contactEmail: `legal-${suffix}@test.local`,
        status: 'active',
      })
      .returning();
    legalRepresentativePersonId = legalRepresentative.id;

    const [orgAdminPerson] = await db
      .insert(people)
      .values({
        firstName: 'Org',
        lastName: 'Admin',
        contactEmail: orgAdminUser.email,
        status: 'active',
      })
      .returning();
    orgAdminPersonId = orgAdminPerson.id;

    const [orgAdminMembership] = await db
      .insert(memberships)
      .values({
        userId: orgAdminUserId,
        personId: orgAdminPersonId,
        organizationId,
        communityId: null,
        unitId: null,
        role: 'org_admin',
        status: 'active',
      })
      .returning();

    const [communityAdminUser] = await db
      .insert(users)
      .values({
        email: `community-admin-fixture-${suffix}@test.local`,
        passwordHash: 'not-used',
        name: 'Community Admin Fixture',
      })
      .returning();
    communityAdminUserId = communityAdminUser.id;
    const [communityAdminPerson] = await db
      .insert(people)
      .values({
        firstName: 'Community',
        lastName: 'Admin',
        contactEmail: communityAdminUser.email,
        status: 'active',
      })
      .returning();
    communityAdminPersonId = communityAdminPerson.id;
    const [communityAdminMembership] = await db
      .insert(memberships)
      .values({
        userId: communityAdminUserId,
        personId: communityAdminPersonId,
        organizationId,
        communityId,
        unitId: null,
        role: 'community_admin',
        status: 'active',
      })
      .returning();

    const [guardUser] = await db
      .insert(users)
      .values({
        email: `guard-fixture-${suffix}@test.local`,
        passwordHash: 'not-used',
        name: 'Guard Fixture',
      })
      .returning();
    guardUserId = guardUser.id;
    const [guardMembership] = await db
      .insert(memberships)
      .values({
        userId: guardUserId,
        organizationId,
        communityId,
        unitId: null,
        role: 'guard',
        status: 'active',
      })
      .returning();

    const { buildApp } = await import('../src/index.js');
    app = (await buildApp()).app;
    token = app.jwt.sign({
      sub: randomUUID(),
      email: 'integration@test.local',
      accountId: randomUUID(),
      personId: orgAdminPersonId,
      orgId: organizationId,
      membershipId: 'platform',
      role: 'org_admin',
      communityId: null,
      unitId: null,
      isPlatformAdmin: true,
    });
    orgAdminToken = app.jwt.sign({
      sub: orgAdminUserId,
      email: orgAdminUser.email,
      accountId: randomUUID(),
      personId: orgAdminPersonId,
      orgId: organizationId,
      membershipId: orgAdminMembership.id,
      role: 'org_admin',
      communityId: null,
      unitId: null,
      isPlatformAdmin: false,
    });
    communityAdminToken = app.jwt.sign({
      sub: communityAdminUserId,
      email: communityAdminUser.email,
      accountId: randomUUID(),
      personId: communityAdminPersonId,
      orgId: organizationId,
      membershipId: communityAdminMembership.id,
      role: 'community_admin',
      communityId,
      unitId: null,
      isPlatformAdmin: false,
    });
    guardToken = app.jwt.sign({
      sub: guardUserId,
      email: guardUser.email,
      accountId: randomUUID(),
      personId: communityAdminPersonId,
      orgId: organizationId,
      membershipId: guardMembership.id,
      role: 'guard',
      communityId,
      unitId: null,
      isPlatformAdmin: false,
    });
  });

  after(async () => {
    await db.delete(users).where(eq(users.id, residentUserId));
    await db.delete(users).where(eq(users.id, orgAdminUserId));
    await db.delete(users).where(eq(users.id, communityAdminUserId));
    await db.delete(users).where(eq(users.id, guardUserId));
    await db.delete(organizations).where(eq(organizations.id, organizationId));
    await db.delete(people).where(
      inArray(people.id, [
        legalRepresentativePersonId,
        orgAdminPersonId,
        communityAdminPersonId,
      ]),
    );
    await app.close();
  });

  it('logs in through account and includes account and person claims', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: 'admin@porteria.local',
        password: 'porteria123',
      },
    });
    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body) as { accessToken: string };
    const payload = app.jwt.verify<{
      sub: string;
      accountId?: string;
      personId?: string;
    }>(body.accessToken);
    assert.ok(payload.sub);
    assert.ok(payload.accountId);
    assert.ok(payload.personId);
  });

  it('rejects moving a node inside its own subtree', async () => {
    const response = await request(
      'PATCH',
      `/api/location-units/${cycleFloorId}`,
      { parentId: cycleUnitId },
    );

    assert.equal(response.statusCode, 400);
    assert.match(response.body, /own subtree/i);
  });

  it('rejects a parent from another structure', async () => {
    const response = await request(
      'PATCH',
      `/api/location-units/${unitAId}`,
      { parentId: otherSectionId },
    );

    assert.equal(response.statusCode, 404);
    assert.match(response.body, /Parent node not found/i);
  });

  it('rejects deleting a node with children', async () => {
    const response = await request('DELETE', `/api/location-units/${floorAId}`);

    assert.equal(response.statusCode, 400);
    assert.match(response.body, /children/i);

    const [stillThere] = await db
      .select({ id: locationUnits.id })
      .from(locationUnits)
      .where(eq(locationUnits.id, floorAId));
    assert.equal(stillThere?.id, floorAId);
  });

  it('rejects deleting a node with residents', async () => {
    const response = await request('DELETE', `/api/location-units/${unitAId}`);

    assert.equal(response.statusCode, 400);
    assert.match(response.body, /residents/i);

    const [resident] = await db
      .select({ id: locationResidents.id })
      .from(locationResidents)
      .where(eq(locationResidents.id, residentId));
    assert.equal(resident?.id, residentId);
  });

  it('rejects deleting a section with nodes', async () => {
    const response = await request(
      'DELETE',
      `/api/sections/${sectionAId}`,
      undefined,
      orgAdminToken,
    );

    assert.equal(response.statusCode, 400);
    assert.match(response.body, /nodes/i);
  });

  it('deletes a leaf node', async () => {
    const createResponse = await request('POST', '/api/location-units', {
      communityId,
      parentId: floorBId,
      name: 'Leaf Unit',
      code: `LEAF-${randomUUID().slice(0, 8)}`,
    });
    assert.equal(createResponse.statusCode, 201);
    const leaf = JSON.parse(createResponse.body) as { id: string };

    const deleteResponse = await request(
      'DELETE',
      `/api/location-units/${leaf.id}`,
    );
    assert.equal(deleteResponse.statusCode, 204);

    const [deleted] = await db
      .select({ id: locationUnits.id })
      .from(locationUnits)
      .where(eq(locationUnits.id, leaf.id));
    assert.equal(deleted, undefined);
  });

  it('requires parentId on the move endpoint', async () => {
    const response = await request(
      'POST',
      `/api/location-units/${unitChildId}/move`,
      {},
    );
    assert.equal(response.statusCode, 400);
    assert.match(response.body, /parentId is required/i);
  });

  it('moves an occupied unit without losing its resident', async () => {
    const response = await request(
      'POST',
      `/api/location-units/${unitAId}/move`,
      { parentId: floorBId },
    );
    assert.equal(response.statusCode, 200);

    const [moved] = await db
      .select({ parentId: locationUnits.parentId, levelPosition: locationUnits.levelPosition })
      .from(locationUnits)
      .where(eq(locationUnits.id, unitAId));
    assert.equal(moved?.parentId, floorBId);
    assert.equal(moved?.levelPosition, 3);

    const [resident] = await db
      .select({ locationUnitId: locationResidents.locationUnitId })
      .from(locationResidents)
      .where(eq(locationResidents.id, residentId));
    assert.equal(resident?.locationUnitId, unitAId);
  });

  it('moves a floor subtree and preserves its child levels', async () => {
    const response = await request(
      'PATCH',
      `/api/location-units/${floorAId}`,
      { parentId: sectionBId },
    );
    assert.equal(response.statusCode, 200);

    const [movedFloor, child] = await Promise.all([
      db
        .select({ parentId: locationUnits.parentId })
        .from(locationUnits)
        .where(eq(locationUnits.id, floorAId)),
      db
        .select({ parentId: locationUnits.parentId, levelPosition: locationUnits.levelPosition })
        .from(locationUnits)
        .where(eq(locationUnits.id, unitChildId)),
    ]);
    assert.equal(movedFloor[0]?.parentId, sectionBId);
    assert.equal(child[0]?.parentId, floorAId);
    assert.equal(child[0]?.levelPosition, 3);
  });

  it('rejects reducing structure levels while deeper nodes exist', async () => {
    const response = await request(
      'PATCH',
      `/api/location-structures/${structureId}`,
      { levelCount: 1 },
      orgAdminToken,
    );

    assert.equal(response.statusCode, 400);
    assert.match(response.body, /deeper levels/i);

    const [structure] = await db
      .select({ levelCount: locationStructures.levelCount })
      .from(locationStructures)
      .where(eq(locationStructures.id, structureId));
    assert.equal(structure?.levelCount, 3);
  });

  it('archives and restores a subtree without touching residents', async () => {
    const archiveResponse = await request(
      'POST',
      `/api/location-units/${floorAId}/archive`,
    );
    assert.equal(archiveResponse.statusCode, 200);
    const archived = JSON.parse(archiveResponse.body) as { affected: number };
    assert.equal(archived.affected, 2);

    const archivedNodes = await db
      .select({ id: locationUnits.id, status: locationUnits.status })
      .from(locationUnits)
      .where(inArray(locationUnits.id, [floorAId, unitChildId]));
    assert.deepEqual(
      archivedNodes.map((node) => node.status),
      ['inactive', 'inactive'],
    );

    const [residentWhileArchived] = await db
      .select({ locationUnitId: locationResidents.locationUnitId })
      .from(locationResidents)
      .where(eq(locationResidents.id, residentId));
    assert.equal(residentWhileArchived?.locationUnitId, unitAId);

    const restoreResponse = await request(
      'POST',
      `/api/location-units/${floorAId}/restore`,
    );
    assert.equal(restoreResponse.statusCode, 200);
    const restored = await db
      .select({ status: locationUnits.status })
      .from(locationUnits)
      .where(inArray(locationUnits.id, [floorAId, unitChildId]));
    assert.deepEqual(
      restored.map((node) => node.status),
      ['active', 'active'],
    );

    const auditRows = await db
      .select({ eventType: events.eventType, metadata: events.metadata })
      .from(events)
      .where(
        and(
          eq(events.organizationId, organizationId),
          eq(events.eventType, 'location_node.archived'),
        ),
      );
    assert.equal(auditRows.length, 1);
    assert.equal(
      (auditRows[0]?.metadata as { affected?: number } | undefined)?.affected,
      2,
    );
  });

  it('serves structures under the community path and reports section unit counts', async () => {
    const structureResponse = await request(
      'GET',
      `/api/communities/${communityId}/location-structures`,
    );
    assert.equal(structureResponse.statusCode, 200);
    const structures = JSON.parse(structureResponse.body) as Array<{ id: string }>;
    assert.equal(structures.some((structure) => structure.id === structureId), true);

    const sectionsResponse = await request(
      'GET',
      `/api/sections?communityId=${communityId}&pageSize=100`,
    );
    assert.equal(sectionsResponse.statusCode, 200);
    const sections = JSON.parse(sectionsResponse.body) as {
      data: Array<{ id: string; unitCount: number }>;
    };
    const sectionB = sections.data.find((section) => section.id === sectionBId);
    assert.equal(sectionB?.unitCount, 2);
  });

  it('lets an org admin create a community and keeps platform read-only', async () => {
    const createResponse = await request(
      'POST',
      '/api/organizations/me/communities',
      {
        name: 'Community From Org Admin',
        address: 'Calle Org Admin 123',
        phone: '555-0100',
        type: 'club',
        latitude: 4.711,
        longitude: -74.0721,
        welcomeMessage: 'Bienvenidos',
        timezone: 'America/Bogota',
        slug: `org-admin-community-${randomUUID().slice(0, 8)}`,
      },
      orgAdminToken,
    );
    assert.equal(createResponse.statusCode, 201);
    const created = JSON.parse(createResponse.body) as {
      id: string;
      organizationId: string;
      type: string;
      latitude: string | null;
    };
    assert.equal(created.organizationId, organizationId);
    assert.equal(created.type, 'club');
    assert.equal(created.latitude, '4.711000');

    const updateResponse = await request(
      'PATCH',
      `/api/communities/${created.id}`,
      {
        phone: '555-0300',
        type: 'otro',
        typeLabel: 'Parque',
        welcomeMessage: 'Bienvenidos al parque',
      },
      orgAdminToken,
    );
    assert.equal(updateResponse.statusCode, 200);
    const updatedCommunity = JSON.parse(updateResponse.body) as {
      type: string;
      typeLabel: string;
      phone: string;
    };
    assert.equal(updatedCommunity.type, 'otro');
    assert.equal(updatedCommunity.typeLabel, 'Parque');
    assert.equal(updatedCommunity.phone, '555-0300');

    const platformUpdate = await request(
      'PATCH',
      `/api/communities/${created.id}`,
      { phone: '000' },
      token,
    );
    assert.equal(platformUpdate.statusCode, 403);

    const listResponse = await request(
      'GET',
      '/api/organizations/me/communities',
      undefined,
      orgAdminToken,
    );
    assert.equal(listResponse.statusCode, 200);
    const list = JSON.parse(listResponse.body) as Array<{ id: string }>;
    assert.equal(list.some((community) => community.id === created.id), true);

    const platformCreate = await request(
      'POST',
      '/api/organizations/me/communities',
      {
        name: 'Forbidden Platform Community',
        address: 'Calle 0',
        timezone: 'UTC',
      },
      token,
    );
    assert.equal(platformCreate.statusCode, 403);
  });

  it('returns community overview with sections and unit counts', async () => {
    const response = await request(
      'GET',
      `/api/communities/${communityId}/overview`,
    );
    assert.equal(response.statusCode, 200);
    const overview = JSON.parse(response.body) as {
      community: { id: string };
      administrator: { email: string } | null;
      pendingAdministrator: { email: string } | null;
      sectionCount: number;
      unitCount: number;
      sections: Array<{ id: string; unitCount: number }>;
    };
    assert.equal(overview.community.id, communityId);
    assert.equal(overview.sections.length > 0, true);
    assert.equal(overview.sectionCount, overview.sections.length);
    assert.equal(
      overview.sections.every((section) => typeof section.unitCount === 'number'),
      true,
    );
    assert.match(
      overview.administrator?.email ?? '',
      /^community-admin-fixture-.*@test\.local$/,
    );
    assert.equal(overview.pendingAdministrator, null);
  });

  it('allows guard read-only hierarchy access and rejects writes', async () => {
    const sections = await request(
      'GET',
      `/api/sections?communityId=${communityId}`,
      undefined,
      guardToken,
    );
    assert.equal(sections.statusCode, 200);
    const units = await request(
      'GET',
      `/api/units?communityId=${communityId}`,
      undefined,
      guardToken,
    );
    assert.equal(units.statusCode, 200);
    const residents = await request(
      'GET',
      `/api/units/${unitAId}/residents`,
      undefined,
      guardToken,
    );
    assert.equal(residents.statusCode, 200);
    const write = await request(
      'POST',
      '/api/sections',
      {
        communityId,
        name: 'Guard Forbidden',
        code: `GUARD-FORBIDDEN-${randomUUID().slice(0, 8)}`,
      },
      guardToken,
    );
    assert.equal(write.statusCode, 403);
  });

  it('rejects access tokens that predate people and accounts', async () => {
    const legacyToken = app!.jwt.sign({
      sub: orgAdminUserId,
      email: 'legacy@test.local',
      orgId: organizationId,
      membershipId: 'platform',
      role: 'org_admin',
      communityId: null,
      unitId: null,
      isPlatformAdmin: true,
    });

    const response = await request('GET', '/api/me', undefined, legacyToken);
    assert.equal(response.statusCode, 401);
    assert.match(JSON.parse(response.body).message, /Legacy token/);
  });

  it('returns 404 for missing resources and 400 for malformed identifiers', async () => {
    const missingUnit = await request(
      'GET',
      `/api/units/${randomUUID()}/residents`,
      undefined,
      orgAdminToken,
    );
    assert.equal(missingUnit.statusCode, 404);

    const malformedUnit = await request(
      'GET',
      '/api/units/not-a-uuid/residents',
      undefined,
      orgAdminToken,
    );
    assert.equal(malformedUnit.statusCode, 400);
    assert.equal((JSON.parse(malformedUnit.body) as { statusCode: number }).statusCode, 400);
  });

  it('blocks platform tenant writes', async () => {
    const response = await request(
      'POST',
      '/api/platform/communities',
      {
        organizationId,
        name: 'Platform Forbidden',
        address: 'Calle 0',
        timezone: 'UTC',
      },
      token,
    );
    assert.equal(response.statusCode, 403);
  });

  it('creates a resident invitation with a location unit', async () => {
    const response = await request(
      'POST',
      '/api/invitations',
      {
        email: `invite-${randomUUID().slice(0, 8)}@test.local`,
        role: 'resident',
        communityId,
        locationUnitId: unitChildId,
      },
      orgAdminToken,
    );
    assert.equal(response.statusCode, 201);
    const body = JSON.parse(response.body) as {
      acceptUrl: string;
      invitation: { locationUnitId: string; communityId: string; role: string };
    };
    assert.equal(body.invitation.locationUnitId, unitChildId);
    assert.equal(body.invitation.communityId, communityId);
    assert.equal(body.invitation.role, 'resident');

    const preview = await app.inject({
      method: 'GET',
      url: `/api/public/invitations/${body.acceptUrl.split('/').pop()!}`,
    });
    assert.equal(preview.statusCode, 200);
    const previewBody = JSON.parse(preview.body) as {
      locationPath: string | null;
      unitCode: string | null;
    };
    assert.match(previewBody.locationPath ?? '', /Floor A \/ Unit A Child$/);
    assert.ok(previewBody.unitCode);
  });

  it('creates a resident membership bound to a leaf location unit', async () => {
    const email = `leaf-user-${randomUUID().slice(0, 8)}@test.local`;
    const response = await request(
      'POST',
      '/api/users',
      {
        email,
        password: 'password123',
        name: 'Leaf User',
        role: 'resident',
        communityId,
        locationUnitId: unitChildId,
      },
      orgAdminToken,
    );
    assert.equal(response.statusCode, 201);
    const body = JSON.parse(response.body) as {
      id: string;
      memberships: Array<{ locationUnitId: string | null }>;
    };
    assert.equal(body.memberships[0]?.locationUnitId, unitChildId);

    await db.delete(users).where(eq(users.id, body.id));
    await db.delete(accounts).where(eq(accounts.email, email));
    await db.delete(people).where(eq(people.contactEmail, email));
  });

  it('returns a resident detail within its unit', async () => {
    const response = await request(
      'GET',
      `/api/units/${unitAId}/residents/${residentId}`,
      undefined,
      orgAdminToken,
    );
    assert.equal(response.statusCode, 200);
    const resident = JSON.parse(response.body) as {
      id: string;
      locationUnitId: string;
    };
    assert.equal(resident.id, residentId);
    assert.equal(resident.locationUnitId, unitAId);
  });

  it('rejects sections and missing locations for resident assignment', async () => {
    const userResponse = await request(
      'POST',
      '/api/users',
      {
        email: `bad-location-${randomUUID().slice(0, 8)}@test.local`,
        password: 'password123',
        name: 'Bad Location',
        role: 'resident',
        communityId,
        locationUnitId: sectionAId,
      },
      orgAdminToken,
    );
    assert.equal(userResponse.statusCode, 400);
    assert.match(userResponse.body, /leaf/i);

    const invitationResponse = await request(
      'POST',
      '/api/invitations',
      {
        email: `bad-invite-${randomUUID().slice(0, 8)}@test.local`,
        role: 'resident',
        communityId,
        locationUnitId: sectionAId,
      },
      orgAdminToken,
    );
    assert.equal(invitationResponse.statusCode, 400);

    const missingLocationResponse = await request(
      'POST',
      '/api/users',
      {
        email: `missing-location-${randomUUID().slice(0, 8)}@test.local`,
        password: 'password123',
        name: 'Missing Location',
        role: 'resident',
        communityId,
        locationUnitId: randomUUID(),
      },
      orgAdminToken,
    );
    assert.equal(missingLocationResponse.statusCode, 404);
  });

  it('lists people for the legal representative picker', async () => {
    const response = await request(
      'GET',
      '/api/people?pageSize=100',
      undefined,
      orgAdminToken,
    );
    assert.equal(response.statusCode, 200);
    const people = JSON.parse(response.body) as Array<{ id: string }>;
    const person = people.find((item) => item.id === legalRepresentativePersonId) as
      | { documentNumber?: string | null }
      | undefined;
    assert.equal(Boolean(person), true);
    assert.notEqual(person?.documentNumber, legalRepresentativeDocument);
    assert.match(person?.documentNumber ?? '', /\*/);

    const duplicate = await request(
      'POST',
      '/api/people',
      {
        firstName: 'Duplicate',
        lastName: 'Person',
        documentType: 'CC',
        documentNumber: legalRepresentativeDocument,
      },
      orgAdminToken,
    );
    assert.equal(duplicate.statusCode, 409);
  });

  it('creates and lists level-2 units for a two-level structure', async () => {
    const structureResponse = await request(
      'POST',
      '/api/location-structures',
      {
        communityId,
        name: `Two Level ${randomUUID().slice(0, 8)}`,
        levelCount: 2,
        level1Name: 'Torre',
        level2Name: 'Apartamento',
      },
      orgAdminToken,
    );
    assert.equal(structureResponse.statusCode, 201);
    const structure = JSON.parse(structureResponse.body) as { id: string };

    const rootResponse = await request(
      'POST',
      '/api/location-units',
      {
        communityId,
        structureId: structure.id,
        name: 'Torre 1',
        code: `T1-${randomUUID().slice(0, 8)}`,
        sectionType: 'other',
        sectionTypeLabel: 'Torre',
      },
      orgAdminToken,
    );
    assert.equal(rootResponse.statusCode, 201);
    const root = JSON.parse(rootResponse.body) as { id: string };

    const unitResponse = await request(
      'POST',
      '/api/units',
      {
        communityId,
        sectionId: root.id,
        code: `T1-101-${randomUUID().slice(0, 8)}`,
        type: 'apartment',
      },
      orgAdminToken,
    );
    assert.equal(unitResponse.statusCode, 201);
    const unit = JSON.parse(unitResponse.body) as { levelPosition: number };
    assert.equal(unit.levelPosition, 2);

    const listResponse = await request(
      'GET',
      `/api/units?communityId=${communityId}&pageSize=100`,
      undefined,
      orgAdminToken,
    );
    assert.equal(listResponse.statusCode, 200);
    const list = JSON.parse(listResponse.body) as {
      data: Array<{ id: string; levelPosition: number }>;
    };
    assert.equal(
      list.data.some((row) => row.levelPosition === 2),
      true,
    );
  });

  it('rejects child units for a one-level structure', async () => {
    const structureResponse = await request(
      'POST',
      '/api/location-structures',
      {
        communityId,
        name: `One Level ${randomUUID().slice(0, 8)}`,
        levelCount: 1,
        level1Name: 'Casa',
      },
      orgAdminToken,
    );
    assert.equal(structureResponse.statusCode, 201);
    const structure = JSON.parse(structureResponse.body) as { id: string };

    const rootResponse = await request(
      'POST',
      '/api/location-units',
      {
        communityId,
        structureId: structure.id,
        name: 'Casa 1',
        code: `C1-${randomUUID().slice(0, 8)}`,
        sectionType: 'house',
      },
      orgAdminToken,
    );
    assert.equal(rootResponse.statusCode, 201);
    const root = JSON.parse(rootResponse.body) as { id: string };

    const unitResponse = await request(
      'POST',
      '/api/units',
      {
        communityId,
        sectionId: root.id,
        code: `C1-CHILD-${randomUUID().slice(0, 8)}`,
        type: 'house',
      },
      orgAdminToken,
    );
    assert.equal(unitResponse.statusCode, 400);
    assert.match(unitResponse.body, /one-level/i);
  });

  it('creates a community admin invitation for an organization community', async () => {
    const response = await request(
      'POST',
      '/api/invitations',
      {
        email: `community-admin-${randomUUID().slice(0, 8)}@test.local`,
        role: 'community_admin',
        communityId,
      },
      orgAdminToken,
    );
    assert.equal(response.statusCode, 201);
    const body = JSON.parse(response.body) as {
      invitation: { role: string; communityId: string; locationUnitId: string | null };
    };
    assert.equal(body.invitation.role, 'community_admin');
    assert.equal(body.invitation.communityId, communityId);
    assert.equal(body.invitation.locationUnitId, null);
  });

  it('allows one community admin email in multiple communities', async () => {
    const secondCommunityResponse = await request(
      'POST',
      '/api/organizations/me/communities',
      {
        name: 'Second Community',
        address: 'Calle 2',
        timezone: 'America/Bogota',
        slug: `second-community-${randomUUID().slice(0, 8)}`,
      },
      orgAdminToken,
    );
    assert.equal(secondCommunityResponse.statusCode, 201);
    const secondCommunity = JSON.parse(secondCommunityResponse.body) as { id: string };
    const email = `multi-admin-${randomUUID().slice(0, 8)}@test.local`;

    for (const targetCommunityId of [communityId, secondCommunity.id]) {
      const response = await request(
        'POST',
        '/api/invitations',
        {
          email,
          role: 'community_admin',
          communityId: targetCommunityId,
        },
        orgAdminToken,
      );
      assert.equal(response.statusCode, 201);
    }
  });

  it('accepts a community admin invitation and creates its account', async () => {
    const email = `accepted-admin-${randomUUID().slice(0, 8)}@test.local`;
    const invitationResponse = await request(
      'POST',
      '/api/invitations',
      {
        email,
        role: 'community_admin',
        communityId,
      },
      orgAdminToken,
    );
    assert.equal(invitationResponse.statusCode, 201);
    const invitation = JSON.parse(invitationResponse.body) as { acceptUrl: string };
    const token = invitation.acceptUrl.split('/').pop()!;

    const preview = await app.inject({
      method: 'GET',
      url: `/api/public/invitations/${token}`,
    });
    assert.equal(preview.statusCode, 200);

    const accept = await app.inject({
      method: 'POST',
      url: `/api/public/invitations/${token}/accept`,
      payload: {
        name: 'Accepted Admin',
        password: 'password123',
      },
    });
    assert.equal(accept.statusCode, 200);
    const accepted = JSON.parse(accept.body) as {
      user: { id: string; email: string };
      activeMembership: { role: string; communityId: string };
    };
    assert.equal(accepted.user.email, email);
    assert.equal(accepted.activeMembership.role, 'community_admin');
    assert.equal(accepted.activeMembership.communityId, communityId);

    await db.delete(users).where(eq(users.id, accepted.user.id));
    await db.delete(accounts).where(eq(accounts.email, email));
    await db.delete(people).where(eq(people.contactEmail, email));
  });

  it('returns scoped daily reports for an org admin', async () => {
    const response = await request(
      'GET',
      `/api/reports/daily?communityId=${communityId}`,
      undefined,
      orgAdminToken,
    );
    assert.equal(response.statusCode, 200);
    const report = JSON.parse(response.body) as {
      date: string;
      totalCalls: number;
      activeOperators: number;
    };
    assert.equal(typeof report.date, 'string');
    assert.equal(typeof report.totalCalls, 'number');
    assert.equal(typeof report.activeOperators, 'number');

    const communityResponse = await request(
      'GET',
      `/api/reports/daily?communityId=${communityId}`,
      undefined,
      communityAdminToken,
    );
    assert.equal(communityResponse.statusCode, 200);

    const platformWithoutScope = await request(
      'GET',
      `/api/reports/daily?communityId=${communityId}`,
      undefined,
      token,
    );
    assert.equal(platformWithoutScope.statusCode, 400);

    const platformResponse = await request(
      'GET',
      `/api/reports/daily?organizationId=${organizationId}&communityId=${communityId}`,
      undefined,
      token,
    );
    assert.equal(platformResponse.statusCode, 200);
    const platformReport = JSON.parse(platformResponse.body) as { totalCalls: number };
    assert.equal(typeof platformReport.totalCalls, 'number');
  });

  it('validates community type and coordinates', async () => {
    const otherWithoutLabel = await request(
      'POST',
      '/api/organizations/me/communities',
      {
        name: 'Invalid Other',
        address: 'Calle 1',
        timezone: 'America/Bogota',
        type: 'otro',
      },
      orgAdminToken,
    );
    assert.equal(otherWithoutLabel.statusCode, 400);

    const invalidCoordinates = await request(
      'POST',
      '/api/organizations/me/communities',
      {
        name: 'Invalid Coordinates',
        address: 'Calle 2',
        timezone: 'America/Bogota',
        type: 'conjunto',
        latitude: 100,
        longitude: -200,
      },
      orgAdminToken,
    );
    assert.equal(invalidCoordinates.statusCode, 400);
  });

  it('returns weekly, monthly, call-stats and event-breakdown reports', async () => {
    const weekly = await request(
      'GET',
      `/api/reports/weekly?week=2026-01-01&communityId=${communityId}`,
    );
    assert.equal(weekly.statusCode, 200);

    const monthly = await request(
      'GET',
      `/api/reports/monthly?month=2026-01&communityId=${communityId}`,
    );
    assert.equal(monthly.statusCode, 200);

    const callStats = await request(
      'GET',
      `/api/reports/call-stats?from=2026-01-01&to=2026-01-31&communityId=${communityId}`,
    );
    assert.equal(callStats.statusCode, 200);

    const breakdown = await request(
      'GET',
      `/api/reports/event-breakdown?from=2026-01-01&to=2026-01-31&bucket=day&communityId=${communityId}`,
    );
    assert.equal(breakdown.statusCode, 200);
  });

  it('creates staff with memberships in multiple communities', async () => {
    const createCommunity = async (name: string) => {
      const response = await request(
        'POST',
        '/api/organizations/me/communities',
        {
          name,
          address: 'Calle Staff',
          timezone: 'America/Bogota',
          slug: `staff-${randomUUID().slice(0, 8)}`,
        },
        orgAdminToken,
      );
      assert.equal(response.statusCode, 201);
      return JSON.parse(response.body) as { id: string };
    };
    const first = await createCommunity('Staff Community A');
    const second = await createCommunity('Staff Community B');
    const email = `multi-staff-${randomUUID().slice(0, 8)}@test.local`;

    const response = await request(
      'POST',
      '/api/users',
      {
        email,
        password: 'password123',
        firstName: 'Multi',
        lastName: 'Staff',
        documentNumber: `DOC-${randomUUID().slice(0, 8)}`,
        phone: '+57 300 000 0000',
        role: 'operator',
        communityIds: [first.id, second.id],
      },
      orgAdminToken,
    );
    assert.equal(response.statusCode, 201);
    const user = JSON.parse(response.body) as {
      id: string;
      memberships: Array<{ communityId: string }>;
    };
    assert.equal(user.memberships.length, 2);
    assert.equal(
      user.memberships.map((membership) => membership.communityId).sort().join(','),
      [first.id, second.id].sort().join(','),
    );
    const personRows = await db
      .select({ id: people.id })
      .from(people)
      .where(eq(people.contactEmail, email));
    assert.equal(personRows.length, 1);

    const list = await request(
      'GET',
      `/api/users?search=${encodeURIComponent(email)}`,
      undefined,
      orgAdminToken,
    );
    assert.equal(list.statusCode, 200);
    const listed = JSON.parse(list.body) as {
      data: Array<{
        personName?: string | null;
        personDocumentNumber?: string | null;
        personPhone?: string | null;
        memberships: Array<{ communityName?: string | null }>;
      }>;
    };
    assert.equal(listed.data.length, 1);
    assert.equal(listed.data[0].personName, 'Multi Staff');
    assert.ok(listed.data[0].personDocumentNumber?.startsWith('DOC-'));
    assert.equal(listed.data[0].personPhone, '+57 300 000 0000');
    assert.deepEqual(
      listed.data[0].memberships.map((membership) => membership.communityName).sort(),
      ['Staff Community A', 'Staff Community B'],
    );

    await db.delete(users).where(eq(users.id, user.id));
    await db.delete(accounts).where(eq(accounts.email, email));
    await db.delete(people).where(eq(people.contactEmail, email));
  });

  it('returns associations for a person without an account', async () => {
    const response = await request(
      'GET',
      `/api/people/${legalRepresentativePersonId}`,
      undefined,
      orgAdminToken,
    );
    assert.equal(response.statusCode, 200);
    const person = JSON.parse(response.body) as {
      accounts: Array<{ id: string }>;
      memberships: Array<{ id: string }>;
    };
    assert.deepEqual(person.accounts, []);
    assert.deepEqual(person.memberships, []);
  });

  it('updates the organization profile while keeping platform read-only', async () => {
    const updateResponse = await request(
      'PATCH',
      '/api/organizations/me',
      {
        nit: '900.123.456',
        phone: '555-0200',
        address: 'Calle Org 456',
        legalRepresentativePersonId,
        welcomeMessage: 'Bienvenidos a la organización',
      },
      orgAdminToken,
    );
    assert.equal(updateResponse.statusCode, 200);
    const updated = JSON.parse(updateResponse.body) as {
      nit: string;
      phone: string;
      address: string;
      legalRepresentativePersonId: string;
      welcomeMessage: string;
      profileCompletedAt: string | null;
    };
    assert.equal(updated.nit, '900123456');
    assert.equal(updated.phone, '555-0200');
    assert.equal(updated.address, 'Calle Org 456');
    assert.equal(updated.legalRepresentativePersonId, legalRepresentativePersonId);
    assert.equal(updated.welcomeMessage, 'Bienvenidos a la organización');
    assert.ok(updated.profileCompletedAt);

    const readResponse = await request(
      'GET',
      '/api/organizations/me',
      undefined,
      orgAdminToken,
    );
    assert.equal(readResponse.statusCode, 200);
    const read = JSON.parse(readResponse.body) as { nit: string };
    assert.equal(read.nit, '900123456');

    const platformUpdate = await request(
      'PATCH',
      '/api/organizations/me',
      { phone: '000' },
      token,
    );
    assert.equal(platformUpdate.statusCode, 403);
  });

  it('rejects a duplicate NIT from another organization', async () => {
    const [otherOrg] = await db
      .insert(organizations)
      .values({
        name: 'NIT Other Org',
        slug: `nit-other-${randomUUID().slice(0, 8)}`,
        nit: '900123457',
      })
      .returning();
    try {
      const response = await request(
        'PATCH',
        '/api/organizations/me',
        { nit: '900123457' },
        orgAdminToken,
      );
      assert.equal(response.statusCode, 409);
    } finally {
      await db.delete(organizations).where(eq(organizations.id, otherOrg.id));
    }
  });

  it('returns the organization overview for superadmin', async () => {
    const response = await request(
      'GET',
      `/api/platform/organizations/${organizationId}/overview`,
      undefined,
      token,
    );
    assert.equal(response.statusCode, 200);
    const overview = JSON.parse(response.body) as {
      organization: { nit: string };
      legalRepresentative: { id: string } | null;
      administrator: { email: string } | null;
      communities: Array<{
        id: string;
        sectionCount: number;
        unitCount: number;
      }>;
    };
    assert.equal(overview.organization.nit, '900123456');
    assert.equal(overview.legalRepresentative?.id, legalRepresentativePersonId);
    assert.match(
      overview.administrator?.email ?? '',
      /^org-admin-.*@test\.local$/,
    );
    assert.equal(overview.communities.length > 0, true);
    assert.equal(
      overview.communities.every(
        (community) =>
          typeof community.sectionCount === 'number' &&
          typeof community.unitCount === 'number',
      ),
      true,
    );
  });

  it('returns 404 for a community overview outside the organization', async () => {
    const suffix = randomUUID().slice(0, 8);
    const [otherOrg] = await db
      .insert(organizations)
      .values({
        name: `Other Overview ${suffix}`,
        slug: `other-overview-${suffix}`,
      })
      .returning();
    const [otherCommunity] = await db
      .insert(communities)
      .values({
        organizationId: otherOrg.id,
        name: `Other Community ${suffix}`,
        slug: `other-community-${suffix}`,
        address: 'Calle Other',
        timezone: 'UTC',
      })
      .returning();
    try {
      const response = await request(
        'GET',
        `/api/communities/${otherCommunity.id}/overview`,
        undefined,
        orgAdminToken,
      );
      assert.equal(response.statusCode, 404);
    } finally {
      await db.delete(organizations).where(eq(organizations.id, otherOrg.id));
    }
  });

  it('uploads and serves an organization logo with the 500 KB rule', async () => {
    const invalidBoundary = `----porteria-invalid-${randomUUID()}`;
    const invalidUpload = Buffer.concat([
      Buffer.from(
        `--${invalidBoundary}\r\nContent-Disposition: form-data; name="kind"\r\n\r\norganization_logo\r\n`,
      ),
      Buffer.from(
        `--${invalidBoundary}\r\nContent-Disposition: form-data; name="file"; filename="logo.txt"\r\nContent-Type: text/plain\r\n\r\nnot-an-image`,
      ),
      Buffer.from(`\r\n--${invalidBoundary}--\r\n`),
    ]);
    const invalidResponse = await app.inject({
      method: 'POST',
      url: '/api/assets',
      headers: {
        authorization: `Bearer ${orgAdminToken}`,
        'content-type': `multipart/form-data; boundary=${invalidBoundary}`,
      },
      payload: invalidUpload,
    });
    assert.equal(invalidResponse.statusCode, 400);

    const boundary = `----porteria-${randomUUID()}`;
    const file = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);
    const multipart = Buffer.concat([
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="kind"\r\n\r\norganization_logo\r\n`,
      ),
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="communityId"\r\n\r\n${communityId}\r\n`,
      ),
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="logo.png"\r\nContent-Type: image/png\r\n\r\n`,
      ),
      file,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);

    const upload = await app.inject({
      method: 'POST',
      url: '/api/assets',
      headers: {
        authorization: `Bearer ${orgAdminToken}`,
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      payload: multipart,
    });
    assert.equal(upload.statusCode, 201);
    const asset = JSON.parse(upload.body) as { id: string; mimeType: string };
    assert.equal(asset.mimeType, 'image/png');

    const content = await app.inject({
      method: 'GET',
      url: `/api/assets/${asset.id}/content`,
      headers: { authorization: `Bearer ${orgAdminToken}` },
    });
    assert.equal(content.statusCode, 200);
    assert.equal(content.headers['content-type'], 'image/png');

    const deleted = await app.inject({
      method: 'DELETE',
      url: `/api/assets/${asset.id}`,
      headers: { authorization: `Bearer ${orgAdminToken}` },
    });
    assert.equal(deleted.statusCode, 204);
  });

  it('audits resident associations', async () => {
    const response = await request(
      'POST',
      `/api/units/${unitChildId}/residents`,
      {
        userId: residentUserId,
        relationship: 'family',
      },
    );
    assert.equal(response.statusCode, 201);

    const [event] = await db
      .select({ eventType: events.eventType, metadata: events.metadata })
      .from(events)
      .where(
        and(
          eq(events.organizationId, organizationId),
          eq(events.eventType, 'location_resident.associated'),
        ),
      );
    assert.equal(event?.eventType, 'location_resident.associated');
    assert.equal(
      (event?.metadata as { locationUnitId?: string } | undefined)?.locationUnitId,
      unitChildId,
    );
  });

  it('manages units through the structure-scoped endpoint', async () => {
    const suffix = randomUUID().slice(0, 8);
    const created = await request(
      'POST',
      `/api/location-structures/${otherStructureId}/units`,
      {
        name: 'Structure Scoped Root',
        code: `STRUCT-ROOT-${suffix}`,
        sectionType: 'tower',
      },
      orgAdminToken,
    );
    assert.equal(created.statusCode, 201);
    const root = JSON.parse(created.body) as { id: string; levelPosition: number };
    assert.equal(root.levelPosition, 1);

    const child = await request(
      'POST',
      `/api/location-structures/${otherStructureId}/units`,
      {
        parentId: root.id,
        name: 'Structure Scoped Floor',
        code: `STRUCT-FLOOR-${suffix}`,
      },
      orgAdminToken,
    );
    assert.equal(child.statusCode, 201);

    const list = await request(
      'GET',
      `/api/location-structures/${otherStructureId}/units`,
      undefined,
      guardToken,
    );
    assert.equal(list.statusCode, 200);
    const body = JSON.parse(list.body) as {
      total: number;
      data: Array<{ id: string; levelPosition: number }>;
    };
    assert.ok(body.total >= 2);
    assert.equal(body.data.some((unit) => unit.id === root.id), true);

    const updated = await request(
      'PATCH',
      `/api/location-structures/${otherStructureId}/units/${root.id}`,
      { name: 'Renamed Structure Root' },
      orgAdminToken,
    );
    assert.equal(updated.statusCode, 200);
    assert.equal(JSON.parse(updated.body).name, 'Renamed Structure Root');
  });

  it('ends a resident association without deleting its history', async () => {
    const created = await request(
      'POST',
      `/api/units/${unitChildId}/residents`,
      {
        userId: residentUserId,
        relationship: 'tenant',
      },
      orgAdminToken,
    );
    assert.equal(created.statusCode, 201);
    const association = JSON.parse(created.body) as { id: string };

    const ended = await request(
      'PATCH',
      `/api/units/${unitChildId}/residents/${association.id}`,
      { status: 'inactive' },
      orgAdminToken,
    );
    assert.equal(ended.statusCode, 200);
    const endedBody = JSON.parse(ended.body) as {
      status: string;
      validTo: string | null;
    };
    assert.equal(endedBody.status, 'inactive');
    assert.ok(endedBody.validTo);

    const history = await request(
      'GET',
      `/api/units/${unitChildId}/residents/${association.id}/history`,
      undefined,
      orgAdminToken,
    );
    assert.equal(history.statusCode, 200);
    const rows = JSON.parse(history.body) as Array<{ id: string; status: string }>;
    assert.equal(rows.some((row) => row.id === association.id && row.status === 'inactive'), true);
  });

  it('shows every community assigned to a community admin', async () => {
    const [secondCommunity] = await db
      .insert(communities)
      .values({
        organizationId,
        name: `Second Admin Community ${randomUUID().slice(0, 8)}`,
        slug: `second-admin-${randomUUID().slice(0, 8)}`,
        address: 'Test address',
        timezone: 'America/Bogota',
      })
      .returning();
    const [assignment] = await db
      .insert(memberships)
      .values({
        userId: communityAdminUserId,
        personId: communityAdminPersonId,
        organizationId,
        communityId: secondCommunity.id,
        role: 'community_admin',
        status: 'active',
      })
      .returning();

    try {
      const response = await request(
        'GET',
        '/api/communities',
        undefined,
        communityAdminToken,
      );
      assert.equal(response.statusCode, 200);
      const ids = (JSON.parse(response.body) as Array<{ id: string }>).map(
        (community) => community.id,
      );
      assert.equal(ids.includes(communityId), true);
      assert.equal(ids.includes(secondCommunity.id), true);
    } finally {
      await db.delete(memberships).where(eq(memberships.id, assignment.id));
      await db.delete(communities).where(eq(communities.id, secondCommunity.id));
    }
  });

  it('creates and deactivates an account for an existing person', async () => {
    const email = `legal-account-${Date.now()}-${Math.random().toString(36).slice(2)}@test.local`;
    const password = 'Password123!';
    const created = await request(
      'POST',
      `/api/people/${legalRepresentativePersonId}/account`,
      { email, password },
      orgAdminToken,
    );
    assert.equal(created.statusCode, 201);
    const account = JSON.parse(created.body) as {
      id: string;
      email: string;
      active: boolean;
    };
    assert.equal(account.email, email);
    assert.equal(account.active, true);

    const [accountUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email));
    await db.insert(memberships).values({
      userId: accountUser.id,
      personId: legalRepresentativePersonId,
      organizationId,
      communityId,
      role: 'tenant',
      status: 'active',
    });

    const login = await request('POST', '/api/auth/login', { email, password });
    assert.equal(login.statusCode, 200);

    const deactivated = await request(
      'PATCH',
      `/api/people/${legalRepresentativePersonId}/account`,
      { active: false },
      orgAdminToken,
    );
    assert.equal(deactivated.statusCode, 200);
    assert.equal(JSON.parse(deactivated.body).active, false);

    const rejectedLogin = await request('POST', '/api/auth/login', { email, password });
    assert.equal(rejectedLogin.statusCode, 401);

    await db.delete(memberships).where(eq(memberships.userId, accountUser.id));
    await db.delete(accounts).where(eq(accounts.email, email));
    await db.delete(users).where(eq(users.email, email));
  });
});
