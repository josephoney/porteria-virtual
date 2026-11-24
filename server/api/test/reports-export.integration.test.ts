import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import type { FastifyInstance } from 'fastify';

process.env.OUTBOX_WORKER_ENABLED = 'false';
process.env.NODE_ENV = 'test';

import { createDb } from '@porteria/database';
import { eq, inArray } from 'drizzle-orm';
import {
  accessPoints,
  accounts,
  bitacoraEntries,
  communities,
  memberships,
  organizations,
  people,
} from '@porteria/database/schema';

const db = createDb();

let app: FastifyInstance;
let orgAId: string;
let orgBId: string;
let communityA1Id: string;
let communityB1Id: string;
let gateA1Id: string;
let gateB1Id: string;
let reportDate: string;
let communityAdminA1Token: string;
let platformToken: string;
const personIds: string[] = [];
const accountIds: string[] = [];
const membershipIds: string[] = [];

function auth(token: string) {
  return { authorization: `Bearer ${token}` };
}

async function request(url: string, token: string) {
  return app.inject({ method: 'GET', url, headers: auth(token) });
}

function localToday(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate(),
  ).padStart(2, '0')}`;
}

/** Instante local del día del reporte, sin pasar por la interpretación UTC. */
function at(hour: number, minute = 0): Date {
  const [year, month, day] = reportDate.split('-').map(Number);
  return new Date(year, month - 1, day, hour, minute, 0, 0);
}

function tokenFor(claims: {
  accountId: string;
  personId: string;
  membershipId: string;
  orgId: string;
  communityId: string | null;
  role: string;
  isPlatformAdmin?: boolean;
}) {
  return app.jwt.sign({
    sub: claims.accountId,
    email: `${claims.role}-${randomUUID().slice(0, 6)}@test.local`,
    accountId: claims.accountId,
    personId: claims.personId,
    orgId: claims.orgId,
    membershipId: claims.membershipId,
    role: claims.role,
    communityId: claims.communityId,
    unitId: null,
    isPlatformAdmin: claims.isPlatformAdmin ?? false,
  });
}

describe('report exports', () => {
  before(async () => {
    const suffix = randomUUID().slice(0, 8);
    reportDate = localToday();
    const { buildApp } = await import('../src/index.js');
    app = (await buildApp()).app;

    const [orgA] = await db
      .insert(organizations)
      .values({ name: `Exportaciones A ${suffix}`, slug: `exportaciones-a-${suffix}` })
      .returning();
    orgAId = orgA.id;
    const [orgB] = await db
      .insert(organizations)
      .values({ name: `Exportaciones B ${suffix}`, slug: `exportaciones-b-${suffix}` })
      .returning();
    orgBId = orgB.id;

    const [communityA1, communityB1] = await db
      .insert(communities)
      .values([
        {
          organizationId: orgAId,
          name: `Exportaciones A1 ${suffix}`,
          slug: `exportaciones-a1-${suffix}`,
          address: 'Calle A1',
          timezone: 'UTC',
        },
        {
          organizationId: orgBId,
          name: `Exportaciones B1 ${suffix}`,
          slug: `exportaciones-b1-${suffix}`,
          address: 'Calle B1',
          timezone: 'UTC',
        },
      ])
      .returning();
    communityA1Id = communityA1.id;
    communityB1Id = communityB1.id;

    const [gateA1, gateB1] = await db
      .insert(accessPoints)
      .values([
        { communityId: communityA1Id, name: `Portón A1 ${suffix}`, direction: 'both' },
        { communityId: communityB1Id, name: `Portón B1 ${suffix}`, direction: 'both' },
      ])
      .returning();
    gateA1Id = gateA1.id;
    gateB1Id = gateB1.id;

    const admin = await db
      .insert(people)
      .values({ firstName: 'Admin', lastName: `A1 ${suffix}`, status: 'active' })
      .returning();
    personIds.push(admin[0].id);
    const adminAccount = await db
      .insert(accounts)
      .values({
        personId: admin[0].id,
        email: `export-admin-${suffix}@test.local`,
        passwordHash: 'x',
      })
      .returning();
    accountIds.push(adminAccount[0].id);
    const adminMembership = await db
      .insert(memberships)
      .values({
        personId: admin[0].id,
        organizationId: orgAId,
        communityId: communityA1Id,
        role: 'community_admin',
        status: 'active',
      })
      .returning();
    membershipIds.push(adminMembership[0].id);

    communityAdminA1Token = tokenFor({
      accountId: adminAccount[0].id,
      personId: admin[0].id,
      membershipId: adminMembership[0].id,
      orgId: orgAId,
      communityId: communityA1Id,
      role: 'community_admin',
    });
    platformToken = tokenFor({
      accountId: randomUUID(),
      personId: randomUUID(),
      membershipId: 'platform',
      orgId: '',
      communityId: null,
      role: 'staff',
      isPlatformAdmin: true,
    });

    await db.insert(bitacoraEntries).values([
      {
        communityId: communityA1Id,
        accessPointId: gateA1Id,
        accessPointName: gateA1.name,
        type: 'pass_entry',
        source: 'app',
        summary: 'Ingreso por QR',
        details: { action: 'entry' },
        createdAt: at(10, 0),
      },
      {
        communityId: communityA1Id,
        accessPointId: gateA1Id,
        accessPointName: gateA1.name,
        type: 'pass_entry',
        source: 'manual_identity',
        summary: 'Ingreso por documento',
        details: { action: 'entry' },
        createdAt: at(10, 30),
      },
      {
        communityId: communityB1Id,
        accessPointId: gateB1Id,
        accessPointName: gateB1.name,
        type: 'pass_entry',
        source: 'app',
        summary: 'Ingreso de otra comunidad',
        details: { action: 'entry' },
        createdAt: at(10, 15),
      },
    ]);
  });

  after(async () => {
    const communityIds = [communityA1Id, communityB1Id].filter(Boolean);
    if (communityIds.length > 0) {
      await db.delete(bitacoraEntries).where(inArray(bitacoraEntries.communityId, communityIds));
      await db.delete(accessPoints).where(inArray(accessPoints.communityId, communityIds));
    }
    if (membershipIds.length > 0) {
      await db.delete(memberships).where(inArray(memberships.id, membershipIds));
    }
    if (accountIds.length > 0) {
      await db.delete(accounts).where(inArray(accounts.id, accountIds));
    }
    if (personIds.length > 0) {
      await db.delete(people).where(inArray(people.id, personIds));
    }
    if (orgAId) await db.delete(organizations).where(inArray(organizations.id, [orgAId, orgBId]));
    await app.close();
  });

  it('exports the access report as CSV with BOM and the current metrics', async () => {
    const response = await request(
      `/api/reports/export?report=access&format=csv&from=${reportDate}&to=${reportDate}`,
      communityAdminA1Token,
    );
    assert.equal(response.statusCode, 200, response.body);
    assert.match(String(response.headers['content-type']), /text\/csv/);
    assert.match(
      String(response.headers['content-disposition']),
      new RegExp(`attachment; filename="accesos-${reportDate}-${reportDate}\\.csv"`),
    );

    const body = response.rawPayload;
    assert.equal(body[0], 0xef, 'el CSV empieza con el BOM UTF-8');
    assert.equal(body[1], 0xbb);
    assert.equal(body[2], 0xbf);

    const text = body.toString('utf8');
    assert.ok(text.includes('Reporte de accesos'), text);
    assert.ok(text.includes('Totales'), text);
    assert.ok(text.includes('Método de verificación'), text);
    assert.ok(text.includes('Documento'), 'el ingreso por documento aparece como método');
    assert.ok(text.includes('Exportaciones A1'), 'el alcance nombra la comunidad');
    assert.ok(!text.includes('Exportaciones B1'), 'no incluye otra comunidad');

    // Los totales del archivo coinciden con los del endpoint de la pantalla.
    const apiResponse = await request(
      `/api/reports/access?from=${reportDate}&to=${reportDate}`,
      communityAdminA1Token,
    );
    assert.equal(apiResponse.statusCode, 200, apiResponse.body);
    const totals = JSON.parse(apiResponse.body).totals as Record<string, number>;
    assert.ok(text.includes(`Accesos,${totals.total}`), text);
    assert.ok(text.includes(`Ingresos,${totals.entries}`), text);
  });

  it('exports the access report as a real XLSX file', async () => {
    const response = await request(
      `/api/reports/export?report=access&format=xlsx&from=${reportDate}&to=${reportDate}`,
      communityAdminA1Token,
    );
    assert.equal(response.statusCode, 200, response.body);
    assert.match(
      String(response.headers['content-type']),
      /application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet/,
    );
    const body = response.rawPayload;
    assert.equal(body.subarray(0, 2).toString('latin1'), 'PK', 'un XLSX es un ZIP');
    assert.ok(body.length > 1000, `archivo demasiado chico: ${body.length} bytes`);
  });

  it('exports the access report as a real PDF file', async () => {
    const response = await request(
      `/api/reports/export?report=access&format=pdf&from=${reportDate}&to=${reportDate}`,
      communityAdminA1Token,
    );
    assert.equal(response.statusCode, 200, response.body);
    assert.equal(response.headers['content-type'], 'application/pdf');
    const body = response.rawPayload;
    assert.equal(body.subarray(0, 4).toString('latin1'), '%PDF');
    assert.ok(body.length > 1000, `archivo demasiado chico: ${body.length} bytes`);
  });

  it('exports the shift report', async () => {
    const response = await request(
      `/api/reports/export?report=shifts&format=csv&from=${reportDate}&to=${reportDate}`,
      communityAdminA1Token,
    );
    assert.equal(response.statusCode, 200, response.body);
    const text = response.rawPayload.toString('utf8');
    assert.ok(text.includes('Reporte de turnos'), text);
    assert.ok(text.includes('Turnos sin cerrar'), text);
  });

  it('narrows the export of a community role to its own community', async () => {
    const response = await request(
      `/api/reports/export?report=access&format=csv&from=${reportDate}&to=${reportDate}&communityId=${communityB1Id}`,
      communityAdminA1Token,
    );
    assert.equal(response.statusCode, 200, response.body);
    const text = response.rawPayload.toString('utf8');
    assert.ok(text.includes('Exportaciones A1'), 'mantiene su comunidad');
    assert.ok(!text.includes('Portón B1'), 'no filtra la comunidad pedida');
  });

  it('rejects an unknown format and an unknown report', async () => {
    const badFormat = await request(
      `/api/reports/export?report=access&format=docx&from=${reportDate}&to=${reportDate}`,
      communityAdminA1Token,
    );
    assert.equal(badFormat.statusCode, 400, badFormat.body);

    const badReport = await request(
      `/api/reports/export?report=calls&format=csv&from=${reportDate}&to=${reportDate}`,
      communityAdminA1Token,
    );
    assert.equal(badReport.statusCode, 400, badReport.body);
  });

  it('requires an organization for the platform administrator', async () => {
    const missing = await request(
      `/api/reports/export?report=access&format=csv&from=${reportDate}&to=${reportDate}`,
      platformToken,
    );
    assert.equal(missing.statusCode, 400, missing.body);

    const scoped = await request(
      `/api/reports/export?report=access&format=csv&from=${reportDate}&to=${reportDate}&organizationId=${orgBId}`,
      platformToken,
    );
    assert.equal(scoped.statusCode, 200, scoped.body);
    const text = scoped.rawPayload.toString('utf8');
    assert.ok(text.includes('Portón B1'), text);
    assert.ok(!text.includes('Portón A1'), 'no mezcla organizaciones');
  });
});
