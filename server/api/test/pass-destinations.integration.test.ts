import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { inArray } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';

process.env.OUTBOX_WORKER_ENABLED = 'false';
process.env.DYNAMIC_QR_ENABLED = 'true';
process.env.PASS_QR_SECRET = 'integration-pass-secret';
process.env.PASS_WEB_URL = 'http://localhost:5176';

import { createDb } from '@porteria/database';
import { eq } from 'drizzle-orm';
import {
  accessPasses,
  accounts,
  communities,
  locationStructures,
  locationUnits,
  memberships,
  organizations,
  people,
  users,
} from '@porteria/database/schema';

const db = createDb();

let app: FastifyInstance;
let organizationId: string;
let communityId: string;
let otherCommunityId: string;
let homeLeafId: string;
let otherHomeLeafId: string;
let commonSectionId: string;
let poolId: string;
let clubId: string;
let archivedId: string;
let foreignNodeId: string;
let residentToken: string;
let otherResidentToken: string;
let orgAdminToken: string;
let structureId: string;
let residentUserId: string;
let residentAccountId: string;
let residentPersonId: string;
let otherResidentUserId: string;
let otherResidentAccountId: string;
let otherResidentPersonId: string;

type Json = Record<string, any>;

function auth(token: string) {
  return { authorization: `Bearer ${token}` };
}

async function request(
  method: 'GET' | 'POST' | 'DELETE',
  url: string,
  payload?: unknown,
  token: string = residentToken,
) {
  return app.inject({
    method,
    url,
    headers: auth(token),
    payload: payload as Record<string, unknown> | undefined,
  });
}

function parse(response: { body: string }): Json {
  return JSON.parse(response.body) as Json;
}

function passPayload(overrides: Json = {}) {
  const now = Date.now();
  return {
    locationUnitId: poolId,
    visitorFirstName: 'Visita',
    visitorLastName: 'Prueba',
    visitorDocument: `DOC-${randomUUID().slice(0, 8)}`,
    type: 'entry_only',
    validFrom: new Date(now - 60_000).toISOString(),
    validUntil: new Date(now + 3_600_000).toISOString(),
    ...overrides,
  };
}

function batchPayload(visitors: Json[], overrides: Json = {}) {
  const now = Date.now();
  return {
    destination: poolId,
    type: 'entry_only',
    validFrom: new Date(now - 60_000).toISOString(),
    validUntil: new Date(now + 3_600_000).toISOString(),
    batchLabel: 'Cumpleaños QA',
    visitors,
    ...overrides,
  };
}

describe('pass destinations integration', () => {
  before(async () => {
    const suffix = randomUUID().slice(0, 8);

    const [organization] = await db
      .insert(organizations)
      .values({ name: `Destination Org ${suffix}`, slug: `destination-org-${suffix}` })
      .returning();
    organizationId = organization.id;

    const [community] = await db
      .insert(communities)
      .values({
        organizationId,
        name: `Destination Community ${suffix}`,
        slug: `destination-community-${suffix}`,
        address: 'Calle Destino 123',
        timezone: 'UTC',
      })
      .returning();
    communityId = community.id;

    const [otherCommunity] = await db
      .insert(communities)
      .values({
        organizationId,
        name: `Other Destination Community ${suffix}`,
        slug: `other-destination-community-${suffix}`,
        address: 'Calle Otro 456',
        timezone: 'UTC',
      })
      .returning();
    otherCommunityId = otherCommunity.id;

    const [structure] = await db
      .insert(locationStructures)
      .values({
        communityId,
        name: 'Estructura Destinos',
        levelCount: 3,
        level1Name: 'Torre',
        level2Name: 'Piso',
        level3Name: 'Apartamento',
      })
      .returning();

    const [homeTower, commonSection] = await db
      .insert(locationUnits)
      .values([
        {
          communityId,
          structureId: structure.id,
          parentId: null,
          levelPosition: 1,
          name: 'Torre A',
          sectionType: 'tower',
        },
        {
          communityId,
          structureId: structure.id,
          parentId: null,
          levelPosition: 1,
          name: 'Zonas comunes',
          sectionType: 'common_area',
        },
      ])
      .returning();

    const [homeFloor] = await db
      .insert(locationUnits)
      .values({
        communityId,
        structureId: structure.id,
        parentId: homeTower.id,
        levelPosition: 2,
        name: 'Piso 1',
      })
      .returning();

    const [homeLeaf] = await db
      .insert(locationUnits)
      .values({
        communityId,
        structureId: structure.id,
        parentId: homeFloor.id,
        levelPosition: 3,
        name: 'A-101',
      })
      .returning();
    homeLeafId = homeLeaf.id;

    const [otherHomeLeaf] = await db
      .insert(locationUnits)
      .values({
        communityId,
        structureId: structure.id,
        parentId: homeFloor.id,
        levelPosition: 3,
        name: 'A-102',
      })
      .returning();
    otherHomeLeafId = otherHomeLeaf.id;

    const [pool, club, sauna] = await db
      .insert(locationUnits)
      .values([
        {
          communityId,
          structureId: structure.id,
          parentId: commonSection.id,
          levelPosition: 2,
          name: 'Piscina',
        },
        {
          communityId,
          structureId: structure.id,
          parentId: commonSection.id,
          levelPosition: 2,
          name: 'Club social',
        },
        {
          communityId,
          structureId: structure.id,
          parentId: commonSection.id,
          levelPosition: 2,
          name: 'Sauna',
          status: 'inactive',
        },
      ])
      .returning();
    commonSectionId = commonSection.id;
    poolId = pool.id;
    clubId = club.id;
    archivedId = sauna.id;

    // Internal common-area node: a club with a named room.
    await db.insert(locationUnits).values({
      communityId,
      structureId: structure.id,
      parentId: clubId,
      levelPosition: 3,
      name: 'Salón',
    });

    const [otherStructure] = await db
      .insert(locationStructures)
      .values({
        communityId: otherCommunityId,
        name: 'Estructura Ajena',
        levelCount: 1,
        level1Name: 'Zona',
      })
      .returning();

    const [foreignNode] = await db
      .insert(locationUnits)
      .values({
        communityId: otherCommunityId,
        structureId: otherStructure.id,
        parentId: null,
        levelPosition: 1,
        name: 'Zona ajena',
        sectionType: 'common_area',
      })
      .returning();
    foreignNodeId = foreignNode.id;

    const [residentPerson, otherResidentPerson] = await db
      .insert(people)
      .values([
        { firstName: 'Residente', lastName: 'Destino', status: 'active' },
        { firstName: 'Residente', lastName: 'Vecino', status: 'active' },
      ])
      .returning();
    residentPersonId = residentPerson.id;
    otherResidentPersonId = otherResidentPerson.id;

    const [residentUser, otherResidentUser] = await db
      .insert(users)
      .values([
        { email: `dest-resident-${suffix}@test.local`, passwordHash: 'x', name: 'Resident' },
        { email: `dest-other-${suffix}@test.local`, passwordHash: 'x', name: 'Neighbour' },
      ])
      .returning();
    residentUserId = residentUser.id;
    otherResidentUserId = otherResidentUser.id;

    const [residentAccount, otherResidentAccount] = await db
      .insert(accounts)
      .values([
        {
          personId: residentPersonId,
          email: `dest-resident-${suffix}@test.local`,
          passwordHash: 'x',
        },
        {
          personId: otherResidentPersonId,
          email: `dest-other-${suffix}@test.local`,
          passwordHash: 'x',
        },
      ])
      .returning();
    residentAccountId = residentAccount.id;
    otherResidentAccountId = otherResidentAccount.id;

    const [residentMembership, otherResidentMembership] = await db
      .insert(memberships)
      .values([
        {
          userId: residentUserId,
          personId: residentPersonId,
          organizationId,
          communityId,
          locationUnitId: homeLeafId,
          role: 'owner',
          status: 'active',
        },
        {
          userId: otherResidentUserId,
          personId: otherResidentPersonId,
          organizationId,
          communityId,
          locationUnitId: otherHomeLeafId,
          role: 'owner',
          status: 'active',
        },
      ])
      .returning();

    const { buildApp } = await import('../src/index.js');
    app = (await buildApp()).app;

    const base = { orgId: organizationId, unitId: homeLeafId, isPlatformAdmin: false };

    orgAdminToken = app.jwt.sign({
      ...base,
      sub: residentUserId,
      accountId: residentAccountId,
      personId: residentPersonId,
      membershipId: residentMembership.id,
      role: 'org_admin',
      communityId,
    });

    const [structureRow] = await db
      .select({ id: locationStructures.id })
      .from(locationStructures)
      .where(eq(locationStructures.communityId, communityId))
      .limit(1);
    structureId = structureRow!.id;
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
      unitId: otherHomeLeafId,
      sub: otherResidentUserId,
      accountId: otherResidentAccountId,
      personId: otherResidentPersonId,
      membershipId: otherResidentMembership.id,
      role: 'owner',
      communityId,
    });
  });

  after(async () => {
    await db
      .delete(accessPasses)
      .where(inArray(accessPasses.communityId, [communityId, otherCommunityId]));
    await db
      .delete(memberships)
      .where(inArray(memberships.communityId, [communityId, otherCommunityId]));
    await db
      .delete(locationUnits)
      .where(inArray(locationUnits.communityId, [communityId, otherCommunityId]));
    await db
      .delete(locationStructures)
      .where(inArray(locationStructures.communityId, [communityId, otherCommunityId]));
    await db.delete(communities).where(inArray(communities.id, [communityId, otherCommunityId]));
    await db
      .delete(accounts)
      .where(inArray(accounts.id, [residentAccountId, otherResidentAccountId]));
    await db.delete(users).where(inArray(users.id, [residentUserId, otherResidentUserId]));
    await db.delete(people).where(inArray(people.id, [residentPersonId, otherResidentPersonId]));
    await db.delete(organizations).where(inArray(organizations.id, [organizationId]));
  });

  it('lists the resident home and the active common areas', async () => {
    const response = await request('GET', '/api/passes/destinations');
    assert.equal(response.statusCode, 200, response.body);

    const destinations = parse(response) as Json[];
    const byName = new Map(destinations.map((destination) => [destination.name, destination]));

    assert.ok(byName.has('A-101'), 'own home is offered');
    assert.equal(byName.get('A-101')!.kind, 'home');
    assert.ok(byName.has('Piscina'), 'common area is offered');
    assert.equal(byName.get('Piscina')!.kind, 'common_area');
    assert.equal(byName.get('Piscina')!.path, 'Zonas comunes › Piscina');

    assert.ok(byName.has('Club social'), 'internal common area header is offered');
    assert.ok(byName.has('Salón'), 'common area leaf is offered');

    assert.ok(!byName.has('Zonas comunes'), 'the level-1 container with children is not offered');
    assert.ok(!byName.has('Sauna'), 'archived nodes are excluded');
    assert.ok(!byName.has('A-102'), 'another resident home is not offered');
  });

  it('creates a pass for a common area and exposes the destination', async () => {
    const created = await request('POST', '/api/passes', passPayload());
    assert.equal(created.statusCode, 201, created.body);

    const list = await request('GET', '/api/passes');
    assert.equal(list.statusCode, 200, list.body);
    assert.equal(list.headers['x-total-count'], '1');

    const [item] = parse(list) as Json[];
    assert.equal(item.destination.name, 'Piscina');
    assert.equal(item.destination.path, 'Zonas comunes › Piscina');
    assert.equal(item.destination.kind, 'common_area');
    assert.equal(item.locationPath, 'Zonas comunes › Piscina');
    assert.equal(item.batchId, null);
  });

  it('allows an internal common area as a destination', async () => {
    const response = await request('POST', '/api/passes', passPayload({ locationUnitId: clubId }));

    assert.equal(response.statusCode, 201, response.body);
  });

  it('rejects an archived node, a foreign node and the level-1 container', async () => {
    const archived = await request(
      'POST',
      '/api/passes',
      passPayload({ locationUnitId: archivedId }),
    );
    assert.equal(archived.statusCode, 400, archived.body);
    assert.equal(parse(archived).message, 'destination_inactive');

    const foreign = await request(
      'POST',
      '/api/passes',
      passPayload({ locationUnitId: foreignNodeId }),
    );
    assert.equal(foreign.statusCode, 404, foreign.body);

    // A common-area section with children is a container, not a destination.
    const container = await request(
      'POST',
      '/api/passes',
      passPayload({ locationUnitId: commonSectionId }),
    );
    assert.equal(container.statusCode, 400, container.body);
    assert.equal(parse(container).message, 'invalid');
  });

  it('rejects a home that belongs to another resident', async () => {
    const response = await request(
      'POST',
      '/api/passes',
      passPayload({ locationUnitId: otherHomeLeafId }),
    );

    assert.equal(response.statusCode, 403, response.body);
  });

  it('creates a batch with partial success and a shared batch id', async () => {
    const existingVisitor = 'B-EXISTING';
    const existing = await request(
      'POST',
      '/api/passes',
      passPayload({ visitorDocument: existingVisitor }),
    );
    assert.equal(existing.statusCode, 201, existing.body);

    const response = await request(
      'POST',
      '/api/passes/batch',
      batchPayload([
        { firstName: 'Ana', lastName: 'Uno', document: 'B-ANA' },
        { firstName: 'Ana', lastName: 'Repetida', document: 'B-ANA' },
        { firstName: 'Bruno', lastName: 'Existente', document: existingVisitor },
        { firstName: 'Carla', lastName: 'Dos', document: 'B-CARLA', vehiclePlate: 'abc123' },
      ]),
    );

    assert.equal(response.statusCode, 201, response.body);
    const result = parse(response);
    assert.equal(result.createdCount, 2);
    assert.equal(result.rejectedCount, 2);
    assert.equal(result.batchLabel, 'Cumpleaños QA');
    assert.equal(result.created[1].vehiclePlate, 'ABC123');
    assert.deepEqual(
      result.rejected.map((row: Json) => row.reason).sort(),
      [
        'documento duplicado en el archivo',
        'ya tiene una autorización activa para ese destino',
      ].sort(),
    );

    const filtered = await request('GET', `/api/passes?batchId=${result.batchId}`);
    assert.equal(filtered.statusCode, 200, filtered.body);
    assert.equal(filtered.headers['x-total-count'], '2');

    const items = parse(filtered) as Json[];
    assert.equal(items.length, 2);
    assert.ok(items.every((item) => item.batchId === result.batchId));
    assert.ok(items.every((item) => item.batchLabel === 'Cumpleaños QA'));
  });

  it('previews a batch without creating passes', async () => {
    const suffix = randomUUID().slice(0, 8);
    const existingVisitor = `P-EXISTING-${suffix}`;
    const existing = await request(
      'POST',
      '/api/passes',
      passPayload({ visitorDocument: existingVisitor }),
    );
    assert.equal(existing.statusCode, 201, existing.body);

    const validDocument = `P-VALID-${suffix}`;
    const response = await request(
      'POST',
      '/api/passes/batch/preview',
      batchPayload([
        { firstName: 'Ana', lastName: `Preview ${suffix}`, document: validDocument },
        { firstName: 'Ana', lastName: 'Repetida', document: validDocument },
        { firstName: 'Bruno', lastName: 'Existente', document: existingVisitor },
      ]),
    );

    assert.equal(response.statusCode, 200, response.body);
    const preview = parse(response);
    assert.equal(preview.total, 3);
    assert.equal(preview.validCount, 1);
    assert.equal(preview.batchLabel, 'Cumpleaños QA');
    assert.deepEqual(
      preview.rejected.map((row: Json) => row.reason).sort(),
      [
        'documento duplicado en el archivo',
        'ya tiene una autorización activa para ese destino',
      ].sort(),
    );

    // The dry run must not touch the database.
    const stored = await request('GET', `/api/passes?search=${validDocument}`);
    assert.equal(stored.statusCode, 200, stored.body);
    assert.equal(parse(stored).length, 0);
  });

  it('rejects a preview with more than 200 visitors', async () => {
    const visitors = Array.from({ length: 201 }, (_, index) => ({
      firstName: 'Preview',
      lastName: `Fila ${index}`,
      document: `PREV-${index}`,
    }));

    const response = await request(
      'POST',
      '/api/passes/batch/preview',
      batchPayload(visitors),
    );

    assert.equal(response.statusCode, 400, response.body);
    const body = parse(response);
    assert.equal(body.message, 'batch_too_large');
    assert.equal(body.max, 200);
  });

  it('filters the history by search and destination', async () => {
    const search = await request('GET', '/api/passes?search=Carla');
    assert.equal(search.statusCode, 200, search.body);
    const found = parse(search) as Json[];
    assert.equal(found.length, 1);
    assert.equal(found[0].visitorFirstName, 'Carla');

    const byDestination = await request('GET', `/api/passes?destinationUnitId=${clubId}`);
    const clubItems = parse(byDestination) as Json[];
    assert.ok(clubItems.length > 0);
    assert.ok(clubItems.every((item) => item.locationUnitId === clubId));
  });

  it('lets another resident authorize their own home', async () => {
    const response = await request(
      'POST',
      '/api/passes',
      passPayload({ locationUnitId: otherHomeLeafId }),
      otherResidentToken,
    );

    assert.equal(response.statusCode, 201, response.body);
  });

  it('rejects a batch with more than 200 visitors', async () => {
    const visitors = Array.from({ length: 201 }, (_, index) => ({
      firstName: 'Masivo',
      lastName: `Fila ${index}`,
      document: `MASS-${index}`,
    }));

    const response = await request('POST', '/api/passes/batch', batchPayload(visitors));

    assert.equal(response.statusCode, 400, response.body);
    const body = parse(response);
    assert.equal(body.message, 'batch_too_large');
    assert.equal(body.max, 200);
  });

  it('creates a common-area section through the API', async () => {
    const response = await request(
      'POST',
      '/api/location-units',
      {
        communityId,
        structureId,
        name: `Zonas QA ${Date.now()}`,
        sectionType: 'common_area',
      },
      orgAdminToken,
    );

    assert.equal(response.statusCode, 201, response.body);
    const created = parse(response);
    assert.equal(created.sectionType, 'common_area');

    const removed = await request(
      'DELETE',
      `/api/location-units/${created.id}`,
      undefined,
      orgAdminToken,
    );
    assert.equal(removed.statusCode, 204, removed.body);
  });

  it('refuses to delete a place that already has authorizations', async () => {
    await request('POST', '/api/passes', passPayload({ locationUnitId: poolId }));

    const response = await request(
      'DELETE',
      `/api/location-units/${poolId}`,
      undefined,
      orgAdminToken,
    );

    assert.equal(response.statusCode, 409, response.body);
    assert.equal(parse(response).code, 'node_has_authorizations');
  });
});
