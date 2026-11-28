import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { and, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';

process.env.OUTBOX_WORKER_ENABLED = 'false';

import { createDb } from '@porteria/database';
import {
  accounts,
  communities,
  events,
  locationStructures,
  locationUnits,
  memberships,
  organizations,
  people,
} from '@porteria/database/schema';

const db = createDb();

let app: FastifyInstance;
let organizationId: string;
let communityId: string;
let structureId: string;
let adminToken: string;
let adminPersonId: string;

type Json = Record<string, any>;

async function request(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  url: string,
  payload?: unknown,
) {
  return app.inject({
    method,
    url,
    headers: { authorization: `Bearer ${adminToken}` },
    payload: payload as Record<string, unknown> | undefined,
  });
}

function parse(response: { body: string }) {
  return JSON.parse(response.body) as Json;
}

describe('structure generation integration', () => {
  before(async () => {
    const suffix = randomUUID().slice(0, 8);

    const [organization] = await db
      .insert(organizations)
      .values({ name: `Gen Org ${suffix}`, slug: `gen-org-${suffix}` })
      .returning();
    organizationId = organization.id;

    const [community] = await db
      .insert(communities)
      .values({
        organizationId,
        name: `Gen Community ${suffix}`,
        slug: `gen-community-${suffix}`,
        address: 'Calle Generación 1',
        timezone: 'UTC',
      })
      .returning();
    communityId = community.id;

    const [structure] = await db
      .insert(locationStructures)
      .values({
        communityId,
        name: 'Estructura',
        levelCount: 3,
        level1Name: 'Torre',
        level2Name: 'Piso',
        level3Name: 'Apartamento',
      })
      .returning();
    structureId = structure.id;

    const [person] = await db
      .insert(people)
      .values({ firstName: 'Admin', lastName: 'Generacion', status: 'active' })
      .returning();
    adminPersonId = person.id;

    const [account] = await db
      .insert(accounts)
      .values({
        personId: person.id,
        email: `gen-admin-${suffix}@test.local`,
        passwordHash: 'x',
      })
      .returning();

    const [membership] = await db
      .insert(memberships)
      .values({
        personId: person.id,
        organizationId,
        communityId,
        role: 'community_admin',
        status: 'active',
      })
      .returning();

    const { buildApp } = await import('../src/index.js');
    app = (await buildApp()).app;

    adminToken = app.jwt.sign({
      email: `gen-admin-${suffix}@test.local`,
      orgId: organizationId,
      unitId: null,
      isPlatformAdmin: false,
      sub: account.id,
      accountId: account.id,
      personId: adminPersonId,
      membershipId: membership.id,
      role: 'community_admin',
      communityId,
    });
  });

  after(async () => {
    await db.delete(locationUnits).where(eq(locationUnits.communityId, communityId));
    await db.delete(locationStructures).where(eq(locationStructures.communityId, communityId));
    await db.delete(memberships).where(eq(memberships.organizationId, organizationId));
    await db.delete(events).where(eq(events.organizationId, organizationId));
    await db.delete(communities).where(eq(communities.id, communityId));
    await db.delete(people).where(eq(people.id, adminPersonId));
    await db.delete(organizations).where(eq(organizations.id, organizationId));
    await app.close();
  });

  async function createNode(payload: Record<string, unknown>) {
    const response = await request('POST', '/api/location-units', payload);
    assert.equal(response.statusCode, 201, response.body);
    return parse(response) as { id: string };
  }

  it('generates floors and units from a level-1 section', async () => {
    const root = await createNode({
      communityId,
      structureId,
      name: 'Hotel',
      branchLevelCount: 3,
    });

    const preview = await request('POST', '/api/location-units/generate', {
      communityId,
      parentId: root.id,
      mode: 'floors',
      floors: 2,
      perFloor: 3,
      unitType: 'habitacion',
      dryRun: true,
    });
    assert.equal(preview.statusCode, 200, preview.body);
    const plan = parse(preview);
    assert.equal(plan.total, 2 + 2 * 3);
    assert.deepEqual(plan.conflicts, []);

    const created = await request('POST', '/api/location-units/generate', {
      communityId,
      parentId: root.id,
      mode: 'floors',
      floors: 2,
      perFloor: 3,
      unitType: 'habitacion',
    });
    assert.equal(created.statusCode, 201, created.body);
    assert.equal(parse(created).created, 8);

    const rows = await db
      .select({ name: locationUnits.name, levelPosition: locationUnits.levelPosition })
      .from(locationUnits)
      .where(eq(locationUnits.communityId, communityId));
    const floors = rows.filter((row) => row.levelPosition === 2).map((row) => row.name);
    const units = rows.filter((row) => row.levelPosition === 3).map((row) => row.name);
    assert.deepEqual(floors.sort(), ['Piso 1', 'Piso 2']);
    assert.deepEqual(units.sort(), ['101', '102', '103', '201', '202', '203']);
  });

  it('generates sequential units under a leaf parent', async () => {
    const [floor] = await db
      .select()
      .from(locationUnits)
      .where(and(eq(locationUnits.communityId, communityId), eq(locationUnits.levelPosition, 2)))
      .limit(1);

    const preview = await request('POST', '/api/location-units/generate', {
      communityId,
      parentId: floor.id,
      mode: 'sequential',
      count: 5,
      prefix: 'Casa',
      dryRun: true,
    });
    assert.equal(preview.statusCode, 200, preview.body);
    const names = (parse(preview).nodes as Json[]).map((node) => node.name);
    assert.deepEqual(names, ['Casa 1', 'Casa 2', 'Casa 3', 'Casa 4', 'Casa 5']);

    const created = await request('POST', '/api/location-units/generate', {
      communityId,
      parentId: floor.id,
      mode: 'sequential',
      count: 5,
      prefix: 'Casa',
    });
    assert.equal(created.statusCode, 201, created.body);
  });

  it('reports conflicts without writing and rejects the creation', async () => {
    const [floor] = await db
      .select()
      .from(locationUnits)
      .where(and(eq(locationUnits.communityId, communityId), eq(locationUnits.levelPosition, 2)))
      .limit(1);

    const before = await db
      .select({ id: locationUnits.id })
      .from(locationUnits)
      .where(eq(locationUnits.communityId, communityId));

    const preview = await request('POST', '/api/location-units/generate', {
      communityId,
      parentId: floor.id,
      mode: 'sequential',
      count: 2,
      prefix: 'Casa',
      dryRun: true,
    });
    assert.equal(preview.statusCode, 200, preview.body);
    assert.equal((parse(preview).conflicts as string[]).length > 0, true);

    const blocked = await request('POST', '/api/location-units/generate', {
      communityId,
      parentId: floor.id,
      mode: 'sequential',
      count: 2,
      prefix: 'Casa',
    });
    assert.equal(blocked.statusCode, 409, blocked.body);
    assert.equal(parse(blocked).code, 'duplicate_name');

    const after = await db
      .select({ id: locationUnits.id })
      .from(locationUnits)
      .where(eq(locationUnits.communityId, communityId));
    assert.equal(after.length, before.length, 'no node must be created on conflict');
  });

  it('creates the section and its content in one call', async () => {
    const preview = await request('POST', '/api/location-units/generate', {
      communityId,
      structureId,
      name: 'Torre Generada',
      branchLevelCount: 3,
      mode: 'floors',
      floors: 2,
      perFloor: 2,
      dryRun: true,
    });
    assert.equal(preview.statusCode, 200, preview.body);
    const plan = parse(preview);
    assert.equal(plan.total, 1 + 2 + 4);

    const created = await request('POST', '/api/location-units/generate', {
      communityId,
      structureId,
      name: 'Torre Generada',
      branchLevelCount: 3,
      mode: 'floors',
      floors: 2,
      perFloor: 2,
    });
    assert.equal(created.statusCode, 201, created.body);
    assert.equal(parse(created).created, 7);

    const [root] = await db
      .select()
      .from(locationUnits)
      .where(and(eq(locationUnits.communityId, communityId), eq(locationUnits.name, 'Torre Generada')));
    assert.equal(root.levelPosition, 1);
    assert.equal(root.branchLevelCount, 3);

    const children = await db
      .select({ name: locationUnits.name, levelPosition: locationUnits.levelPosition })
      .from(locationUnits)
      .where(eq(locationUnits.parentId, root.id));
    assert.equal(children.length, 2);
    assert.equal(children.every((row) => row.levelPosition === 2), true);
  });

  it('generates several intermediate nodes sequentially', async () => {
    const root = await createNode({
      communityId,
      structureId,
      name: 'Torre Pisos',
      branchLevelCount: 3,
    });

    const created = await request('POST', '/api/location-units/generate', {
      communityId,
      parentId: root.id,
      mode: 'sequential',
      count: 3,
      prefix: 'Piso',
    });
    assert.equal(created.statusCode, 201, created.body);
    assert.equal(parse(created).created, 3);

    const floors = await db
      .select({ name: locationUnits.name, levelPosition: locationUnits.levelPosition })
      .from(locationUnits)
      .where(eq(locationUnits.parentId, root.id));
    assert.deepEqual(floors.map((row) => row.name).sort(), ['Piso 1', 'Piso 2', 'Piso 3']);
    assert.equal(
      floors.every((row) => row.levelPosition === 2),
      true,
    );
  });

  it('requires two free levels for the floors mode', async () => {
    const [floor] = await db
      .select()
      .from(locationUnits)
      .where(and(eq(locationUnits.communityId, communityId), eq(locationUnits.levelPosition, 2)))
      .limit(1);

    const response = await request('POST', '/api/location-units/generate', {
      communityId,
      parentId: floor.id,
      mode: 'floors',
      floors: 2,
      perFloor: 2,
      dryRun: true,
    });
    assert.equal(response.statusCode, 400, response.body);
    assert.equal(parse(response).code, 'mode_not_applicable');
  });
});
