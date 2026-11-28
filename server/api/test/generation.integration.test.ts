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
        level1Name: 'Sector',
        level2Name: 'Casa',
        level3Name: 'Cuarto',
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

  it('creates the section and its levels in one call', async () => {
    const preview = await request('POST', '/api/location-units/generate', {
      communityId,
      structureId,
      branchLevelCount: 3,
      levels: [
        { count: 1, prefix: 'Sector Uno' },
        { count: 2, prefix: 'Casa' },
        { count: 2, prefix: 'Cuarto' },
      ],
      dryRun: true,
    });
    assert.equal(preview.statusCode, 200, preview.body);
    assert.equal(parse(preview).total, 1 + 2 + 4);

    const created = await request('POST', '/api/location-units/generate', {
      communityId,
      structureId,
      branchLevelCount: 3,
      levels: [
        { count: 1, prefix: 'Sector Uno' },
        { count: 2, prefix: 'Casa' },
        { count: 2, prefix: 'Cuarto' },
      ],
    });
    assert.equal(created.statusCode, 201, created.body);
    assert.equal(parse(created).created, 7);

    const rows = await db
      .select({ name: locationUnits.name, levelPosition: locationUnits.levelPosition })
      .from(locationUnits)
      .where(eq(locationUnits.communityId, communityId));
    assert.equal(rows.filter((row) => row.levelPosition === 1).length, 1);
    assert.equal(rows.filter((row) => row.levelPosition === 2).length, 2);
    assert.equal(rows.filter((row) => row.levelPosition === 3).length, 4);
  });

  it('generates sequential units under a leaf parent', async () => {
    const [sector] = await db
      .select()
      .from(locationUnits)
      .where(and(eq(locationUnits.communityId, communityId), eq(locationUnits.levelPosition, 1)))
      .limit(1);
    const [house] = await db
      .select()
      .from(locationUnits)
      .where(eq(locationUnits.parentId, sector.id))
      .limit(1);

    const preview = await request('POST', '/api/location-units/generate', {
      communityId,
      parentId: house.id,
      levels: [{ count: 3, prefix: 'Cuarto' }],
      dryRun: true,
    });
    assert.equal(preview.statusCode, 200, preview.body);
    assert.deepEqual(
      (parse(preview).nodes as Json[]).map((node) => node.name),
      ['Cuarto 1', 'Cuarto 2', 'Cuarto 3'],
    );
  });

  it('generates several intermediate nodes sequentially', async () => {
    const sector = await createNode({
      communityId,
      structureId,
      name: 'Sector Secuencial',
      branchLevelCount: 3,
    });

    const created = await request('POST', '/api/location-units/generate', {
      communityId,
      parentId: sector.id,
      levels: [{ count: 3, prefix: 'Casa' }],
    });
    assert.equal(created.statusCode, 201, created.body);

    const houses = await db
      .select({ name: locationUnits.name })
      .from(locationUnits)
      .where(eq(locationUnits.parentId, sector.id));
    assert.equal(houses.length, 3);
  });

  it('simplifies the names when asked', async () => {
    const created = await request('POST', '/api/location-units/generate', {
      communityId,
      structureId,
      branchLevelCount: 3,
      levels: [
        { count: 1, prefix: 'Bloque' },
        { count: 1, prefix: 'Casa' },
        { count: 2, prefix: 'Cuarto', padding: 2 },
      ],
      simplified: true,
    });
    assert.equal(created.statusCode, 201, created.body);

    const [room] = await db
      .select({ name: locationUnits.name, code: locationUnits.code })
      .from(locationUnits)
      .where(and(eq(locationUnits.communityId, communityId), eq(locationUnits.name, '1-101')))
      .limit(1);
    assert.equal(room.name, '1-101');
    assert.equal(room.code, '1-101');
  });

  it('reports conflicts without writing and rejects the creation', async () => {
    const before = await db
      .select({ id: locationUnits.id })
      .from(locationUnits)
      .where(eq(locationUnits.communityId, communityId));

    const preview = await request('POST', '/api/location-units/generate', {
      communityId,
      structureId,
      branchLevelCount: 3,
      levels: [{ count: 2, prefix: 'Sector Uno' }],
      dryRun: true,
    });
    assert.equal(preview.statusCode, 200, preview.body);
    assert.equal((parse(preview).conflicts as string[]).length > 0, true);

    const blocked = await request('POST', '/api/location-units/generate', {
      communityId,
      structureId,
      branchLevelCount: 3,
      levels: [{ count: 2, prefix: 'Sector Uno' }],
    });
    assert.equal(blocked.statusCode, 409, blocked.body);
    assert.equal(parse(blocked).code, 'duplicate_name');

    const after = await db
      .select({ id: locationUnits.id })
      .from(locationUnits)
      .where(eq(locationUnits.communityId, communityId));
    assert.equal(after.length, before.length, 'no node must be created on conflict');
  });

  it('rejects more levels than the branch allows', async () => {
    const [house] = await db
      .select()
      .from(locationUnits)
      .where(and(eq(locationUnits.communityId, communityId), eq(locationUnits.levelPosition, 2)))
      .limit(1);

    const response = await request('POST', '/api/location-units/generate', {
      communityId,
      parentId: house.id,
      levels: [
        { count: 1, prefix: 'Cuarto' },
        { count: 1, prefix: 'Extra' },
      ],
      dryRun: true,
    });
    assert.equal(response.statusCode, 400, response.body);
    assert.equal(parse(response).code, 'invalid_params');
  });
});
