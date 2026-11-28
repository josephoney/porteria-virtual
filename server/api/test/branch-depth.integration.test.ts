import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { eq } from 'drizzle-orm';
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
let adminAccountId: string;

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

describe('branch depth integration', () => {
  before(async () => {
    const suffix = randomUUID().slice(0, 8);

    const [organization] = await db
      .insert(organizations)
      .values({ name: `Depth Org ${suffix}`, slug: `depth-org-${suffix}` })
      .returning();
    organizationId = organization.id;

    const [community] = await db
      .insert(communities)
      .values({
        organizationId,
        name: `Depth Community ${suffix}`,
        slug: `depth-community-${suffix}`,
        address: 'Calle Profundidad 1',
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
      .values({ firstName: 'Admin', lastName: 'Profundidad', status: 'active' })
      .returning();
    adminPersonId = person.id;

    const [account] = await db
      .insert(accounts)
      .values({
        personId: person.id,
        email: `depth-admin-${suffix}@test.local`,
        passwordHash: 'x',
      })
      .returning();
    adminAccountId = account.id;

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
      email: `depth-admin-${suffix}@test.local`,
      orgId: organizationId,
      unitId: null,
      isPlatformAdmin: false,
      sub: adminAccountId,
      accountId: adminAccountId,
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

  it('creates a two-level branch and stops it at level 2', async () => {
    const root = await request('POST', '/api/location-units', {
      communityId,
      structureId,
      name: 'Torre Dos',
      branchLevelCount: 2,
    });
    assert.equal(root.statusCode, 201, root.body);
    const rootNode = parse(root);
    assert.equal(rootNode.branchLevelCount, 2);

    const floor = await request('POST', '/api/location-units', {
      communityId,
      parentId: rootNode.id,
      name: 'Piso 1',
    });
    assert.equal(floor.statusCode, 201, floor.body);
    assert.equal(parse(floor).branchLevelCount, 2);

    const tooDeep = await request('POST', '/api/location-units', {
      communityId,
      parentId: parse(floor).id,
      name: 'A-101',
    });
    assert.equal(tooDeep.statusCode, 400, tooDeep.body);
    assert.equal(parse(tooDeep).code, 'branch_level_exceeded');

    // El piso es hoja: aparece en el listado de unidades.
    const units = await request('GET', `/api/units?communityId=${communityId}&pageSize=50`);
    assert.equal(units.statusCode, 200, units.body);
    const items = parse(units).data as Json[];
    assert.equal(
      items.some((item) => item.id === parse(floor).id),
      true,
    );
  });

  it('increases the depth with children and refuses to reduce it', async () => {
    const [root] = await db
      .select()
      .from(locationUnits)
      .where(eq(locationUnits.communityId, communityId))
      .limit(1);

    const increased = await request('PATCH', `/api/location-units/${root.id}`, {
      branchLevelCount: 3,
    });
    assert.equal(increased.statusCode, 200, increased.body);
    assert.equal(parse(increased).branchLevelCount, 3);

    const [floor] = await db
      .select()
      .from(locationUnits)
      .where(eq(locationUnits.parentId, root.id))
      .limit(1);

    const leaf = await request('POST', '/api/location-units', {
      communityId,
      parentId: floor.id,
      name: 'A-101',
    });
    assert.equal(leaf.statusCode, 201, leaf.body);

    const reduced = await request('PATCH', `/api/location-units/${root.id}`, {
      branchLevelCount: 2,
    });
    assert.equal(reduced.statusCode, 409, reduced.body);
    assert.equal(parse(reduced).code, 'branch_has_deeper_children');
  });

  it('rejects a depth above the structure maximum', async () => {
    const response = await request('POST', '/api/location-units', {
      communityId,
      structureId,
      name: 'Torre Imposible',
      branchLevelCount: 4,
    });
    assert.equal(response.statusCode, 400, response.body);
  });
});
