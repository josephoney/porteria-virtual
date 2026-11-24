import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import type { FastifyInstance } from 'fastify';

process.env.OUTBOX_WORKER_ENABLED = 'false';
process.env.RETENTION_WORKER_ENABLED = 'false';
process.env.NODE_ENV = 'test';

import { createDb } from '@porteria/database';
import { eq, inArray } from 'drizzle-orm';
import {
  accessPasses,
  accessPoints,
  accounts,
  bitacoraEntries,
  communities,
  locationStructures,
  locationUnits,
  memberships,
  organizations,
  passScans,
  people,
  retentionRuns,
} from '@porteria/database/schema';

import { anonymizeOrganization, retentionCutoff } from '../src/services/retention.service.js';

const db = createDb();

let app: FastifyInstance;
let orgAId: string;
let orgBId: string;
let communityAId: string;
let communityBId: string;
let structureAId: string;
let unitAId: string;
let structureBId: string;
let unitBId: string;
let gateAId: string;
let gateBId: string;
let residentPersonId: string;
let residentAccountId: string;
let adminPersonId: string;
let adminAccountId: string;
let adminMembershipId: string;
let adminToken: string;
let platformToken: string;
let oldPassAId: string;
let newPassAId: string;
let oldPassBId: string;
let oldScanAId: string;
let newScanAId: string;
let oldEntryAId: string;
let newEntryAId: string;
let oldEntryBId: string;
let reportFrom: string;
let reportTo: string;
let accessTotalsBefore: Record<string, number>;

/** Fecha local en formato YYYY-MM-DD, sin pasar por UTC. */
function localDateString(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;
}

function daysBefore(date: Date, days: number): Date {
  return new Date(date.getTime() - days * 86_400_000);
}

async function request(
  method: 'GET' | 'PATCH',
  url: string,
  token: string,
  payload?: Record<string, unknown>,
) {
  return app.inject({
    method,
    url,
    headers: { authorization: `Bearer ${token}` },
    ...(payload ? { payload } : {}),
  });
}

describe('retención de datos de acceso', () => {
  before(async () => {
    const suffix = randomUUID().slice(0, 8);
    const { buildApp } = await import('../src/index.js');
    app = (await buildApp()).app;

    const [orgA] = await db
      .insert(organizations)
      .values({ name: `Retención A ${suffix}`, slug: `retencion-a-${suffix}` })
      .returning();
    orgAId = orgA.id;
    const [orgB] = await db
      .insert(organizations)
      .values({ name: `Retención B ${suffix}`, slug: `retencion-b-${suffix}` })
      .returning();
    orgBId = orgB.id;

    const [communityA, communityB] = await db
      .insert(communities)
      .values([
        {
          organizationId: orgAId,
          name: `Conjunto A ${suffix}`,
          slug: `retencion-conjunto-a-${suffix}`,
          address: 'Calle A',
          timezone: 'UTC',
        },
        {
          organizationId: orgBId,
          name: `Conjunto B ${suffix}`,
          slug: `retencion-conjunto-b-${suffix}`,
          address: 'Calle B',
          timezone: 'UTC',
        },
      ])
      .returning();
    communityAId = communityA.id;
    communityBId = communityB.id;

    const [structureA] = await db
      .insert(locationStructures)
      .values({ communityId: communityAId, name: 'Casa A', levelCount: 1, level1Name: 'Casa' })
      .returning();
    const [unitA] = await db
      .insert(locationUnits)
      .values({
        communityId: communityAId,
        structureId: structureA.id,
        levelPosition: 1,
        name: 'Casa 1 A',
      })
      .returning();
    structureAId = structureA.id;
    unitAId = unitA.id;

    const [structureB] = await db
      .insert(locationStructures)
      .values({ communityId: communityBId, name: 'Casa B', levelCount: 1, level1Name: 'Casa' })
      .returning();
    const [unitB] = await db
      .insert(locationUnits)
      .values({
        communityId: communityBId,
        structureId: structureB.id,
        levelPosition: 1,
        name: 'Casa 1 B',
      })
      .returning();
    structureBId = structureB.id;
    unitBId = unitB.id;

    const [gateA, gateB] = await db
      .insert(accessPoints)
      .values([
        { communityId: communityAId, name: 'Portón A', direction: 'both' },
        { communityId: communityBId, name: 'Portón B', direction: 'both' },
      ])
      .returning();
    gateAId = gateA.id;
    gateBId = gateB.id;

    const [resident] = await db
      .insert(people)
      .values({
        firstName: 'Residente',
        lastName: 'Original',
        documentType: 'CC',
        documentNumber: '1234567890',
        phone: '3001234567',
        status: 'active',
      })
      .returning();
    residentPersonId = resident.id;
    const [residentAccount] = await db
      .insert(accounts)
      .values({ personId: resident.id, email: `residente-${suffix}@test.local`, passwordHash: 'x' })
      .returning();
    residentAccountId = residentAccount.id;

    const [admin] = await db
      .insert(people)
      .values({ firstName: 'Admin', lastName: 'Retención', status: 'active' })
      .returning();
    adminPersonId = admin.id;
    const [adminAccount] = await db
      .insert(accounts)
      .values({
        personId: admin.id,
        email: `admin-retencion-${suffix}@test.local`,
        passwordHash: 'x',
      })
      .returning();
    adminAccountId = adminAccount.id;
    const [membership] = await db
      .insert(memberships)
      .values({
        personId: admin.id,
        organizationId: orgAId,
        communityId: null,
        role: 'org_admin',
        status: 'active',
      })
      .returning();
    adminMembershipId = membership.id;

    adminToken = app.jwt.sign({
      sub: adminAccountId,
      email: `admin-retencion-${suffix}@test.local`,
      accountId: adminAccountId,
      personId: adminPersonId,
      orgId: orgAId,
      membershipId: adminMembershipId,
      role: 'org_admin',
      communityId: null,
      unitId: null,
      isPlatformAdmin: false,
    });
    platformToken = app.jwt.sign({
      sub: adminAccountId,
      email: 'platform@test.local',
      accountId: adminAccountId,
      personId: adminPersonId,
      orgId: orgAId,
      membershipId: adminMembershipId,
      role: 'org_admin',
      communityId: null,
      unitId: null,
      isPlatformAdmin: true,
    });

    // Fuera de la ventana: doce meses hacia atrás, con un día de margen.
    const cutoff = retentionCutoff(12);
    const oldValidity = daysBefore(cutoff, 1);

    const basePass = (linkExpiresAt: Date) => ({
      type: 'entry_exit' as const,
      maxUses: 10,
      validFrom: daysBefore(oldValidity, 2),
      linkTokenHash: randomUUID().replace(/-/g, ''),
      linkExpiresAt,
    });

    const [oldPassA, newPassA, oldPassB] = await db
      .insert(accessPasses)
      .values([
        {
          ...basePass(oldValidity),
          communityId: communityAId,
          structureId: structureAId,
          locationUnitId: unitAId,
          createdByPersonId: residentPersonId,
          authorizedByPersonId: residentPersonId,
          visitorFirstName: 'Visitante',
          visitorLastName: 'Antiguo',
          visitorDocument: 'DOC-ANTIGUO-A',
          vehiclePlate: 'ABC123',
          hasVehicle: true,
          validUntil: oldValidity,
        },
        {
          ...basePass(new Date(Date.now() + 86_400_000)),
          communityId: communityAId,
          structureId: structureAId,
          locationUnitId: unitAId,
          createdByPersonId: residentPersonId,
          authorizedByPersonId: residentPersonId,
          visitorFirstName: 'Visitante',
          visitorLastName: 'Reciente',
          visitorDocument: 'DOC-RECIENTE-A',
          validFrom: new Date(),
          validUntil: new Date(Date.now() + 86_400_000),
        },
        {
          ...basePass(oldValidity),
          communityId: communityBId,
          structureId: structureBId,
          locationUnitId: unitBId,
          createdByPersonId: residentPersonId,
          authorizedByPersonId: residentPersonId,
          visitorFirstName: 'Visitante',
          visitorLastName: 'Vecino',
          visitorDocument: 'DOC-ANTIGUO-B',
          validUntil: oldValidity,
        },
      ])
      .returning();
    oldPassAId = oldPassA.id;
    newPassAId = newPassA.id;
    oldPassBId = oldPassB.id;

    const scanBase = {
      communityId: communityAId,
      locationUnitId: unitAId,
      structureId: structureAId,
      guardPersonId: adminPersonId,
      accessPointId: gateAId,
      accessPointName: 'Portón A',
      visitorFirstName: 'Visitante',
      visitorLastName: 'Escaneado',
      visitorDocument: 'DOC-ESCANEO',
      action: 'entry' as const,
      result: 'authorized' as const,
      status: 'confirmed' as const,
    };
    const [oldScanA, newScanA] = await db
      .insert(passScans)
      .values([
        {
          ...scanBase,
          passId: oldPassAId,
          scannedAt: oldValidity,
          confirmedAt: oldValidity,
          tokenJti: randomUUID(),
        },
        {
          ...scanBase,
          passId: newPassAId,
          scannedAt: new Date(),
          confirmedAt: new Date(),
          tokenJti: randomUUID(),
        },
      ])
      .returning();
    oldScanAId = oldScanA.id;
    newScanAId = newScanA.id;

    const entryBase = {
      accessPointId: gateAId,
      accessPointName: 'Portón A',
      type: 'pass_entry' as const,
      source: 'app' as const,
      authorPersonId: adminPersonId,
      summary: 'Ingreso',
    };
    const [oldEntryA, newEntryA, oldEntryB] = await db
      .insert(bitacoraEntries)
      .values([
        {
          ...entryBase,
          communityId: communityAId,
          createdAt: oldValidity,
          authorizedByName: 'Guardia Antiguo',
          details: {
            action: 'entry',
            visitor: { firstName: 'Visitante', document: 'DOC-ANTIGUO-A' },
            companions: [{ firstName: 'Acompañante' }],
            vehiclePlate: 'ABC123',
            authorizedByName: 'Guardia Antiguo',
          },
        },
        {
          ...entryBase,
          communityId: communityAId,
          createdAt: new Date(),
          authorizedByName: 'Guardia Reciente',
          details: {
            action: 'entry',
            visitor: { firstName: 'Visitante', document: 'DOC-RECIENTE-A' },
            authorizedByName: 'Guardia Reciente',
          },
        },
        {
          ...entryBase,
          communityId: communityBId,
          accessPointId: gateBId,
          accessPointName: 'Portón B',
          createdAt: oldValidity,
          authorizedByName: 'Guardia Vecino',
          details: {
            action: 'entry',
            visitor: { firstName: 'Visitante', document: 'DOC-ANTIGUO-B' },
            authorizedByName: 'Guardia Vecino',
          },
        },
      ])
      .returning();
    oldEntryAId = oldEntryA.id;
    newEntryAId = newEntryA.id;
    oldEntryBId = oldEntryB.id;

    reportFrom = localDateString(oldValidity);
    reportTo = localDateString(new Date());

    const report = await request(
      'GET',
      `/api/reports/access?from=${reportFrom}&to=${reportTo}&organizationId=${orgAId}`,
      platformToken,
    );
    assert.equal(report.statusCode, 200);
    accessTotalsBefore = JSON.parse(report.body).totals;
  });

  after(async () => {
    const communityIds = [communityAId, communityBId];
    await db.delete(retentionRuns).where(inArray(retentionRuns.organizationId, [orgAId, orgBId]));
    await db.delete(bitacoraEntries).where(inArray(bitacoraEntries.communityId, communityIds));
    await db.delete(passScans).where(inArray(passScans.communityId, communityIds));
    await db
      .delete(accessPasses)
      .where(inArray(accessPasses.id, [oldPassAId, newPassAId, oldPassBId]));
    await db.delete(locationUnits).where(inArray(locationUnits.communityId, communityIds));
    await db
      .delete(locationStructures)
      .where(inArray(locationStructures.communityId, communityIds));
    await db.delete(accessPoints).where(inArray(accessPoints.communityId, communityIds));
    await db.delete(communities).where(inArray(communities.id, communityIds));
    await db.delete(memberships).where(eq(memberships.id, adminMembershipId));
    await db.delete(accounts).where(inArray(accounts.id, [residentAccountId, adminAccountId]));
    await db.delete(people).where(inArray(people.id, [residentPersonId, adminPersonId]));
    await db.delete(organizations).where(inArray(organizations.id, [orgAId, orgBId]));
    await app.close();
  });

  it('simula la corrida sin escribir y la registra en el historial', async () => {
    const outcome = await anonymizeOrganization(orgAId, 12, { dryRun: true });

    assert.equal(outcome.dryRun, true);
    assert.equal(outcome.passes, 1);
    assert.equal(outcome.scans, 1);
    assert.equal(outcome.entries, 1);

    const [pass] = await db
      .select()
      .from(accessPasses)
      .where(eq(accessPasses.id, oldPassAId))
      .limit(1);
    assert.equal(pass.visitorFirstName, 'Visitante');
    assert.equal(pass.visitorDocument, 'DOC-ANTIGUO-A');

    const runs = await db
      .select()
      .from(retentionRuns)
      .where(eq(retentionRuns.organizationId, orgAId));
    assert.equal(runs.length, 1);
    assert.equal(runs[0].dryRun, true);
    assert.equal(runs[0].retentionMonths, 12);
    assert.equal(runs[0].anonymizedPasses, 1);
  });

  it('anonimiza sólo lo que está fuera de la ventana', async () => {
    const outcome = await anonymizeOrganization(orgAId, 12, { dryRun: false });
    assert.equal(outcome.passes, 1);
    assert.equal(outcome.scans, 1);
    assert.equal(outcome.entries, 1);

    const [oldPass, newPass] = await Promise.all([
      db.select().from(accessPasses).where(eq(accessPasses.id, oldPassAId)).limit(1),
      db.select().from(accessPasses).where(eq(accessPasses.id, newPassAId)).limit(1),
    ]);
    assert.equal(oldPass[0].visitorFirstName, 'Anonimizado');
    assert.equal(oldPass[0].visitorLastName, '');
    assert.equal(oldPass[0].visitorDocument, 'ANONIMIZADO');
    assert.equal(oldPass[0].vehiclePlate, null);
    assert.equal(oldPass[0].hasVehicle, false);
    assert.deepEqual(oldPass[0].companions, []);
    assert.equal(newPass[0].visitorDocument, 'DOC-RECIENTE-A');

    const [oldScan, newScan] = await Promise.all([
      db.select().from(passScans).where(eq(passScans.id, oldScanAId)).limit(1),
      db.select().from(passScans).where(eq(passScans.id, newScanAId)).limit(1),
    ]);
    assert.equal(oldScan[0].visitorDocument, 'ANONIMIZADO');
    assert.equal(oldScan[0].visitorFirstName, 'Anonimizado');
    assert.equal(newScan[0].visitorDocument, 'DOC-ESCANEO');

    const [oldEntry, newEntry] = await Promise.all([
      db.select().from(bitacoraEntries).where(eq(bitacoraEntries.id, oldEntryAId)).limit(1),
      db.select().from(bitacoraEntries).where(eq(bitacoraEntries.id, newEntryAId)).limit(1),
    ]);
    const oldDetails = oldEntry[0].details as Record<string, unknown>;
    assert.equal(oldDetails.visitor, undefined);
    assert.equal(oldDetails.companions, undefined);
    assert.equal(oldDetails.vehiclePlate, undefined);
    assert.equal(oldDetails.authorizedByName, undefined);
    assert.equal(oldDetails.action, 'entry');
    assert.equal(oldEntry[0].authorizedByName, null);
    assert.equal(newEntry[0].authorizedByName, 'Guardia Reciente');
    assert.notEqual((newEntry[0].details as Record<string, unknown>).visitor, undefined);
  });

  it('no toca el directorio de personas ni las cuentas', async () => {
    const [person] = await db.select().from(people).where(eq(people.id, residentPersonId)).limit(1);
    assert.equal(person.firstName, 'Residente');
    assert.equal(person.documentNumber, '1234567890');
    assert.equal(person.phone, '3001234567');

    const [account] = await db
      .select()
      .from(accounts)
      .where(eq(accounts.id, residentAccountId))
      .limit(1);
    assert.match(account.email, /^residente-/);
  });

  it('la organización vecina conserva sus datos', async () => {
    const [pass] = await db
      .select()
      .from(accessPasses)
      .where(eq(accessPasses.id, oldPassBId))
      .limit(1);
    assert.equal(pass.visitorDocument, 'DOC-ANTIGUO-B');

    const [entry] = await db
      .select()
      .from(bitacoraEntries)
      .where(eq(bitacoraEntries.id, oldEntryBId))
      .limit(1);
    assert.equal(entry.authorizedByName, 'Guardia Vecino');
  });

  it('el reporte de accesos conserva sus totales', async () => {
    const report = await request(
      'GET',
      `/api/reports/access?from=${reportFrom}&to=${reportTo}&organizationId=${orgAId}`,
      platformToken,
    );
    assert.equal(report.statusCode, 200);
    assert.deepEqual(JSON.parse(report.body).totals, accessTotalsBefore);
  });

  it('una segunda corrida no encuentra nada que anonimizar', async () => {
    const outcome = await anonymizeOrganization(orgAId, 12, { dryRun: false });
    assert.equal(outcome.passes, 0);
    assert.equal(outcome.scans, 0);
    assert.equal(outcome.entries, 0);
  });

  it('rechaza una ventana fuera de rango y guarda la elegida', async () => {
    for (const invalid of [0, 61, 2.5]) {
      const response = await request('PATCH', '/api/organizations/me', adminToken, {
        retentionMonths: invalid,
      });
      assert.equal(response.statusCode, 400);
    }

    const accepted = await request('PATCH', '/api/organizations/me', adminToken, {
      retentionMonths: 18,
    });
    assert.equal(accepted.statusCode, 200);
    assert.equal(JSON.parse(accepted.body).retentionMonths, 18);
  });

  it('lista las corridas de la más reciente a la más antigua', async () => {
    const response = await request('GET', '/api/organizations/me/retention-runs', adminToken);
    assert.equal(response.statusCode, 200);
    const runs = JSON.parse(response.body).data as { ranAt: string; dryRun: boolean }[];
    assert.ok(runs.length >= 3);
    const timestamps = runs.map((run) => new Date(run.ranAt).getTime());
    const sorted = [...timestamps].sort((a, b) => b - a);
    assert.deepEqual(timestamps, sorted);
    assert.equal(runs[0].dryRun, false);
  });

  it('la bitácora sigue siendo inmutable fuera de la anonimización', async () => {
    await assert.rejects(
      () =>
        db
          .update(bitacoraEntries)
          .set({ summary: 'Ingreso reescrito' })
          .where(eq(bitacoraEntries.id, newEntryAId)),
      /immutable/,
    );

    // Agregar un campo al detalle tampoco es una anonimización: la fila gana
    // información en vez de perderla, y el registro debe rechazarla.
    await assert.rejects(
      () =>
        db
          .update(bitacoraEntries)
          .set({ details: { action: 'entry', visitor: { firstName: 'Otro' } } })
          .where(eq(bitacoraEntries.id, newEntryAId)),
      /immutable/,
    );
  });
});
