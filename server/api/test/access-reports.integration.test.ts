import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import type { FastifyInstance } from 'fastify';

process.env.OUTBOX_WORKER_ENABLED = 'false';
process.env.NODE_ENV = 'test';

import { createDb } from '@porteria/database';
import { and, count, eq, inArray } from 'drizzle-orm';
import {
  accessPasses,
  accessPoints,
  accounts,
  bitacoraEntries,
  communities,
  guardShiftSegments,
  guardShifts,
  locationStructures,
  locationUnits,
  memberships,
  organizations,
  passScans,
  people,
} from '@porteria/database/schema';

const db = createDb();

const ACCESS_TYPES = ['pass_entry', 'pass_exit', 'pass_rejected', 'scan_denied', 'manual'] as const;

let app: FastifyInstance;
let orgAId: string;
let orgBId: string;
let communityA1Id: string;
let communityB1Id: string;
let structureA1Id: string;
let unitA1Id: string;
let structureB1Id: string;
let unitB1Id: string;
let gateA1Id: string;
let gateA2Id: string;
let gateB1Id: string;
let guard1PersonId: string;
let guard2PersonId: string;
let passA1Id: string;
let passB1Id: string;
let closedShiftAId: string;
let closedShiftBId: string;
let openShiftCId: string;
let reportDate: string;
let communityAdminA1Token: string;
let platformToken: string;
const personIds: string[] = [];
const accountIds: string[] = [];
const membershipIds: string[] = [];
const shiftIds: string[] = [];

type Json = Record<string, any>;

function auth(token: string) {
  return { authorization: `Bearer ${token}` };
}

async function request(method: 'GET', url: string, token: string) {
  return app.inject({ method, url, headers: auth(token) });
}

function parse(response: { body: string }): Json {
  return JSON.parse(response.body) as Json;
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

/** Día local del servidor, igual que lo resuelve `report-dates`. */
function localToday(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate(),
  ).padStart(2, '0')}`;
}

/** Instante local del día del reporte, sin pasar por la interpretación UTC. */
function at(hour: number, minute = 0, second = 0): Date {
  const [year, month, day] = reportDate.split('-').map(Number);
  return new Date(year, month - 1, day, hour, minute, second, 0);
}

function addSeconds(date: Date, seconds: number): Date {
  return new Date(date.getTime() + seconds * 1000);
}

async function createPerson(firstName: string, lastName: string) {
  const [person] = await db
    .insert(people)
    .values({ firstName, lastName, status: 'active' })
    .returning();
  personIds.push(person.id);
  return person;
}

async function createAccount(personId: string, email: string) {
  const [account] = await db
    .insert(accounts)
    .values({ personId, email, passwordHash: 'x' })
    .returning();
  accountIds.push(account.id);
  return account;
}

async function createMembership(input: {
  personId: string;
  organizationId: string;
  communityId: string | null;
  role: 'community_admin' | 'owner';
}) {
  const [membership] = await db
    .insert(memberships)
    .values({
      personId: input.personId,
      organizationId: input.organizationId,
      communityId: input.communityId,
      role: input.role,
      status: 'active',
    })
    .returning();
  membershipIds.push(membership.id);
  return membership;
}

async function createStructure(communityId: string, name: string) {
  const [structure] = await db
    .insert(locationStructures)
    .values({ communityId, name, levelCount: 1, level1Name: 'Casa' })
    .returning();
  const [unit] = await db
    .insert(locationUnits)
    .values({ communityId, structureId: structure.id, levelPosition: 1, name })
    .returning();
  return { structure, unit };
}

async function createPass(input: {
  communityId: string;
  structureId: string;
  locationUnitId: string;
  createdByPersonId: string;
  authorizedByPersonId: string;
  visitorDocument: string;
}) {
  const [pass] = await db
    .insert(accessPasses)
    .values({
      communityId: input.communityId,
      structureId: input.structureId,
      locationUnitId: input.locationUnitId,
      createdByPersonId: input.createdByPersonId,
      authorizedByPersonId: input.authorizedByPersonId,
      visitorFirstName: 'Visitante',
      visitorLastName: input.visitorDocument,
      visitorDocument: input.visitorDocument,
      type: 'entry_exit',
      maxUses: 10,
      validFrom: new Date(Date.now() - 60_000),
      validUntil: new Date(Date.now() + 86_400_000),
      linkTokenHash: randomUUID().replace(/-/g, ''),
      linkExpiresAt: new Date(Date.now() + 86_400_000),
    })
    .returning();
  return pass;
}

async function insertEntry(input: {
  communityId: string;
  accessPointId: string;
  accessPointName: string;
  type: (typeof ACCESS_TYPES)[number];
  source: 'app' | 'dashboard' | 'system' | 'manual_identity';
  createdAt: Date;
  shiftId?: string | null;
  passScanId?: string | null;
  authorPersonId?: string | null;
  details?: Record<string, unknown>;
  summary?: string;
}) {
  const [entry] = await db
    .insert(bitacoraEntries)
    .values({
      communityId: input.communityId,
      accessPointId: input.accessPointId,
      accessPointName: input.accessPointName,
      type: input.type,
      source: input.source,
      shiftId: input.shiftId ?? null,
      passScanId: input.passScanId ?? null,
      authorPersonId: input.authorPersonId ?? null,
      summary: input.summary ?? `Evento ${input.type}`,
      details: input.details ?? {},
      createdAt: input.createdAt,
    })
    .returning();
  return entry;
}

function scanValues(input: {
  passId: string;
  communityId: string;
  locationUnitId: string;
  structureId: string;
  guardPersonId: string;
  accessPointId: string;
  accessPointName: string;
  action: 'entry' | 'exit';
  scannedAt: Date;
  confirmedAt: Date;
  document: string;
}) {
  return {
    passId: input.passId,
    communityId: input.communityId,
    locationUnitId: input.locationUnitId,
    structureId: input.structureId,
    guardPersonId: input.guardPersonId,
    accessPointId: input.accessPointId,
    accessPointName: input.accessPointName,
    visitorFirstName: 'Visitante',
    visitorLastName: input.document,
    visitorDocument: input.document,
    action: input.action,
    result: 'authorized' as const,
    status: 'confirmed' as const,
    scannedAt: input.scannedAt,
    confirmedAt: input.confirmedAt,
    tokenJti: randomUUID(),
  };
}

describe('access and shift reports over the bitacora', () => {
  before(async () => {
    const suffix = randomUUID().slice(0, 8);
    reportDate = localToday();
    const { buildApp } = await import('../src/index.js');
    app = (await buildApp()).app;

    const [orgA] = await db
      .insert(organizations)
      .values({ name: `Reportes accesos A ${suffix}`, slug: `reportes-accesos-a-${suffix}` })
      .returning();
    orgAId = orgA.id;
    const [orgB] = await db
      .insert(organizations)
      .values({ name: `Reportes accesos B ${suffix}`, slug: `reportes-accesos-b-${suffix}` })
      .returning();
    orgBId = orgB.id;

    const [communityA1, communityB1] = await db
      .insert(communities)
      .values([
        {
          organizationId: orgAId,
          name: `Accesos A1 ${suffix}`,
          slug: `accesos-a1-${suffix}`,
          address: 'Calle A1',
          timezone: 'UTC',
        },
        {
          organizationId: orgBId,
          name: `Accesos B1 ${suffix}`,
          slug: `accesos-b1-${suffix}`,
          address: 'Calle B1',
          timezone: 'UTC',
        },
      ])
      .returning();
    communityA1Id = communityA1.id;
    communityB1Id = communityB1.id;

    const structureA1 = await createStructure(communityA1Id, 'Unidad A1');
    structureA1Id = structureA1.structure.id;
    unitA1Id = structureA1.unit.id;
    const structureB1 = await createStructure(communityB1Id, 'Unidad B1');
    structureB1Id = structureB1.structure.id;
    unitB1Id = structureB1.unit.id;

    const [gateA1, gateA2, gateB1] = await db
      .insert(accessPoints)
      .values([
        { communityId: communityA1Id, name: `Portón A1 ${suffix}`, direction: 'both' },
        { communityId: communityA1Id, name: `Portón A2 ${suffix}`, direction: 'both' },
        { communityId: communityB1Id, name: `Portón B1 ${suffix}`, direction: 'both' },
      ])
      .returning();
    gateA1Id = gateA1.id;
    gateA2Id = gateA2.id;
    gateB1Id = gateB1.id;

    const residentA1 = await createPerson('Residente', `A1 ${suffix}`);
    const residentB1 = await createPerson('Residente', `B1 ${suffix}`);
    const guard1 = await createPerson('Guardia', `Uno ${suffix}`);
    guard1PersonId = guard1.id;
    const guard2 = await createPerson('Guardia', `Dos ${suffix}`);
    guard2PersonId = guard2.id;
    const communityAdmin = await createPerson('Admin', `A1 ${suffix}`);
    const communityAdminAccount = await createAccount(
      communityAdmin.id,
      `reportes-accesos-admin-${suffix}@test.local`,
    );
    const communityAdminMembership = await createMembership({
      personId: communityAdmin.id,
      organizationId: orgAId,
      communityId: communityA1Id,
      role: 'community_admin',
    });

    communityAdminA1Token = tokenFor({
      accountId: communityAdminAccount.id,
      personId: communityAdmin.id,
      membershipId: communityAdminMembership.id,
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

    const passA1 = await createPass({
      communityId: communityA1Id,
      structureId: structureA1Id,
      locationUnitId: unitA1Id,
      createdByPersonId: residentA1.id,
      authorizedByPersonId: residentA1.id,
      visitorDocument: `ACC-A1-${suffix}`,
    });
    passA1Id = passA1.id;
    const passB1 = await createPass({
      communityId: communityB1Id,
      structureId: structureB1Id,
      locationUnitId: unitB1Id,
      createdByPersonId: residentB1.id,
      authorizedByPersonId: residentB1.id,
      visitorDocument: `ACC-B1-${suffix}`,
    });
    passB1Id = passB1.id;

    // Turnos: A y B cerrados, C abierto.
    const [closedShiftA, closedShiftB, openShiftC] = await db
      .insert(guardShifts)
      .values([
        {
          communityId: communityA1Id,
          guardPersonId: guard1PersonId,
          status: 'closed',
          startedAt: at(8),
          endedAt: at(12),
          closedReason: 'manual',
        },
        {
          communityId: communityA1Id,
          guardPersonId: guard2PersonId,
          status: 'closed',
          startedAt: at(8),
          endedAt: at(10, 30),
          closedReason: 'manual',
        },
        {
          communityId: communityA1Id,
          guardPersonId: guard1PersonId,
          status: 'open',
          startedAt: at(13),
        },
      ])
      .returning();
    closedShiftAId = closedShiftA.id;
    closedShiftBId = closedShiftB.id;
    openShiftCId = openShiftC.id;
    shiftIds.push(closedShiftAId, closedShiftBId, openShiftCId);

    const [closedShiftB1] = await db
      .insert(guardShifts)
      .values({
        communityId: communityB1Id,
        guardPersonId: guard1PersonId,
        status: 'closed',
        startedAt: at(8),
        endedAt: at(9),
        closedReason: 'manual',
      })
      .returning();
    shiftIds.push(closedShiftB1.id);

    // Escaneos QR confirmados que respaldan la latencia de los accesos QR.
    const [scanEntry, scanExit, scanNoShift, scanShiftB] = await db
      .insert(passScans)
      .values([
        scanValues({
          passId: passA1Id,
          communityId: communityA1Id,
          locationUnitId: unitA1Id,
          structureId: structureA1Id,
          guardPersonId: guard1PersonId,
          accessPointId: gateA1Id,
          accessPointName: gateA1.name,
          action: 'entry',
          scannedAt: at(10, 0, 0),
          confirmedAt: addSeconds(at(10, 0, 0), 20),
          document: `ACC-A1-1-${suffix}`,
        }),
        scanValues({
          passId: passA1Id,
          communityId: communityA1Id,
          locationUnitId: unitA1Id,
          structureId: structureA1Id,
          guardPersonId: guard1PersonId,
          accessPointId: gateA1Id,
          accessPointName: gateA1.name,
          action: 'exit',
          scannedAt: at(10, 5, 0),
          confirmedAt: addSeconds(at(10, 5, 0), 10),
          document: `ACC-A1-2-${suffix}`,
        }),
        scanValues({
          passId: passA1Id,
          communityId: communityA1Id,
          locationUnitId: unitA1Id,
          structureId: structureA1Id,
          guardPersonId: guard2PersonId,
          accessPointId: gateA2Id,
          accessPointName: gateA2.name,
          action: 'entry',
          scannedAt: at(9, 0, 0),
          confirmedAt: addSeconds(at(9, 0, 0), 30),
          document: `ACC-A1-8-${suffix}`,
        }),
        scanValues({
          passId: passA1Id,
          communityId: communityA1Id,
          locationUnitId: unitA1Id,
          structureId: structureA1Id,
          guardPersonId: guard2PersonId,
          accessPointId: gateA2Id,
          accessPointName: gateA2.name,
          action: 'entry',
          scannedAt: at(9, 30, 0),
          confirmedAt: addSeconds(at(9, 30, 0), 30),
          document: `ACC-A1-9-${suffix}`,
        }),
      ])
      .returning();

    // 9 filas de acceso en A1: QR, documento, rechazo, falla de código y
    // observaciones manuales. La fila 8 no tiene turno.
    await db.insert(bitacoraEntries).values([
      {
        communityId: communityA1Id,
        accessPointId: gateA1Id,
        accessPointName: gateA1.name,
        type: 'pass_entry',
        source: 'app',
        shiftId: closedShiftAId,
        passScanId: scanEntry.id,
        authorPersonId: guard1PersonId,
        summary: 'Ingreso por QR',
        details: { action: 'entry' },
        createdAt: at(10, 0, 0),
      },
      {
        communityId: communityA1Id,
        accessPointId: gateA1Id,
        accessPointName: gateA1.name,
        type: 'pass_exit',
        source: 'app',
        shiftId: closedShiftAId,
        passScanId: scanExit.id,
        authorPersonId: guard1PersonId,
        summary: 'Salida por QR',
        details: { action: 'exit' },
        createdAt: at(10, 5, 0),
      },
      {
        communityId: communityA1Id,
        accessPointId: gateA1Id,
        accessPointName: gateA1.name,
        type: 'pass_entry',
        source: 'manual_identity',
        shiftId: closedShiftAId,
        authorPersonId: guard1PersonId,
        summary: 'Ingreso por documento',
        details: { action: 'entry', identityCheck: true },
        createdAt: at(11, 0, 0),
      },
      {
        communityId: communityA1Id,
        accessPointId: gateA1Id,
        accessPointName: gateA1.name,
        type: 'scan_denied',
        source: 'app',
        shiftId: closedShiftAId,
        authorPersonId: guard1PersonId,
        summary: 'Escaneo denegado: invalid_or_expired_token',
        details: { reason: 'invalid_or_expired_token', action: 'entry' },
        createdAt: at(11, 10, 0),
      },
      {
        communityId: communityA1Id,
        accessPointId: gateA1Id,
        accessPointName: gateA1.name,
        type: 'pass_rejected',
        source: 'app',
        shiftId: closedShiftAId,
        authorPersonId: guard1PersonId,
        summary: 'Ingreso rechazado',
        details: { reason: 'denied_by_guard', action: 'entry' },
        createdAt: at(11, 20, 0),
      },
      {
        communityId: communityA1Id,
        accessPointId: gateA1Id,
        accessPointName: gateA1.name,
        type: 'manual',
        source: 'dashboard',
        shiftId: closedShiftAId,
        authorPersonId: guard1PersonId,
        summary: 'Novedad con dirección',
        details: { action: 'entry', note: 'Novedad' },
        createdAt: at(11, 30, 0),
      },
      {
        communityId: communityA1Id,
        accessPointId: gateA1Id,
        accessPointName: gateA1.name,
        type: 'manual',
        source: 'dashboard',
        shiftId: closedShiftAId,
        authorPersonId: guard1PersonId,
        summary: 'Novedad sin dirección',
        details: { note: 'Novedad' },
        createdAt: at(11, 40, 0),
      },
      {
        communityId: communityA1Id,
        accessPointId: gateA2Id,
        accessPointName: gateA2.name,
        type: 'pass_entry',
        source: 'app',
        shiftId: null,
        passScanId: scanNoShift.id,
        authorPersonId: guard2PersonId,
        summary: 'Ingreso sin turno',
        details: { action: 'entry' },
        createdAt: at(9, 0, 0),
      },
      {
        communityId: communityA1Id,
        accessPointId: gateA2Id,
        accessPointName: gateA2.name,
        type: 'pass_entry',
        source: 'app',
        shiftId: closedShiftBId,
        passScanId: scanShiftB.id,
        authorPersonId: guard2PersonId,
        summary: 'Ingreso del turno B',
        details: { action: 'entry' },
        createdAt: at(9, 30, 0),
      },
    ]);

    // Fila de otra comunidad para comprobar que el rol acotado no la ve.
    await insertEntry({
      communityId: communityB1Id,
      accessPointId: gateB1Id,
      accessPointName: gateB1.name,
      type: 'pass_entry',
      source: 'app',
      createdAt: at(10, 0, 0),
      details: { action: 'entry' },
    });
  });

  after(async () => {
    const communityIds = [communityA1Id, communityB1Id].filter(Boolean);
    if (communityIds.length > 0) {
      await db.delete(bitacoraEntries).where(inArray(bitacoraEntries.communityId, communityIds));
      await db.delete(passScans).where(inArray(passScans.communityId, communityIds));
      await db.delete(accessPasses).where(inArray(accessPasses.communityId, communityIds));
    }
    if (shiftIds.length > 0) {
      await db.delete(guardShiftSegments).where(inArray(guardShiftSegments.shiftId, shiftIds));
      await db.delete(guardShifts).where(inArray(guardShifts.id, shiftIds));
    }
    if (communityIds.length > 0) {
      await db.delete(accessPoints).where(inArray(accessPoints.communityId, communityIds));
      await db.delete(locationUnits).where(inArray(locationUnits.communityId, communityIds));
      await db
        .delete(locationStructures)
        .where(inArray(locationStructures.communityId, communityIds));
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

  it('reports totals, method and latency from the real bitacora rows', async () => {
    const response = await request(
      'GET',
      `/api/reports/access?from=${reportDate}&to=${reportDate}&granularity=day&communityId=${communityA1Id}`,
      communityAdminA1Token,
    );
    assert.equal(response.statusCode, 200, response.body);
    const body = parse(response);

    const [seeded] = await db
      .select({ value: count() })
      .from(bitacoraEntries)
      .where(
        and(
          eq(bitacoraEntries.communityId, communityA1Id),
          inArray(bitacoraEntries.type, [...ACCESS_TYPES]),
        ),
      );
    assert.equal(body.totals.total, Number(seeded.value));
    assert.equal(body.totals.total, 9);
    assert.equal(body.totals.authorized, 5);
    assert.equal(body.totals.denied, 1);
    assert.equal(body.totals.codeFailure, 1);
    assert.equal(body.totals.observation, 2);
    assert.equal(body.totals.entries, 7);
    assert.equal(body.totals.exits, 1);
    assert.notEqual(body.totals.entries, body.totals.total, 'las salidas no se suman');

    const methods = Object.fromEntries(
      (body.byMethod as Json[]).map((row) => [row.method, row.count]),
    );
    assert.equal(methods.document, 1, 'la verificación por documento cuenta como acceso');
    assert.equal(methods.qr, 8);

    const points = Object.fromEntries(
      (body.byAccessPoint as Json[]).map((row) => [row.accessPointId, row.count]),
    );
    assert.equal(points[gateA1Id], 7);
    assert.equal(points[gateA2Id], 2);

    const byHour = Object.fromEntries((body.byHour as Json[]).map((row) => [row.hour, row.count]));
    assert.equal(byHour[9], 2);
    assert.equal(byHour[10], 2);
    assert.equal(byHour[11], 5);

    assert.deepEqual(body.denialReasons, [{ reason: 'denied_by_guard', count: 1 }]);
    assert.equal(body.latency.averageSeconds, 22.5);
    assert.equal(body.latency.confirmedScans, 4);
    assert.equal(body.latency.accessCount, 9);

    assert.equal(body.series.length, 1);
    assert.equal(body.series[0].date, reportDate);
    assert.equal(body.series[0].total, 9);
    assert.equal(body.series[0].observation, 2);
    assert.equal(body.series[0].entries, 7);
    assert.equal(body.series[0].exits, 1);
  });

  it('groups the series by week and month', async () => {
    const week = await request(
      'GET',
      `/api/reports/access?from=${reportDate}&to=${reportDate}&granularity=week&communityId=${communityA1Id}`,
      communityAdminA1Token,
    );
    assert.equal(week.statusCode, 200, week.body);
    const weekBody = parse(week);
    const [year, month, day] = reportDate.split('-').map(Number);
    const local = new Date(year, month - 1, day);
    const dayOfWeek = local.getDay();
    local.setDate(local.getDate() + (dayOfWeek === 0 ? -6 : 1 - dayOfWeek));
    const monday = `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, '0')}-${String(
      local.getDate(),
    ).padStart(2, '0')}`;
    assert.equal(weekBody.series.length, 1);
    assert.equal(weekBody.series[0].date, monday);
    assert.equal(weekBody.series[0].total, 9);

    const monthResponse = await request(
      'GET',
      `/api/reports/access?from=${reportDate}&to=${reportDate}&granularity=month&communityId=${communityA1Id}`,
      communityAdminA1Token,
    );
    assert.equal(monthResponse.statusCode, 200, monthResponse.body);
    const monthBody = parse(monthResponse);
    assert.equal(monthBody.series.length, 1);
    assert.equal(monthBody.series[0].date, reportDate.slice(0, 7));
    assert.equal(monthBody.series[0].total, 9);
  });

  it('attributes every bitacora access, including document entries, to its shift', async () => {
    const [documentEntry] = await db
      .select({ shiftId: bitacoraEntries.shiftId })
      .from(bitacoraEntries)
      .where(
        and(
          eq(bitacoraEntries.communityId, communityA1Id),
          eq(bitacoraEntries.source, 'manual_identity'),
        ),
      )
      .limit(1);
    assert.equal(documentEntry.shiftId, closedShiftAId);

    const response = await request(
      'GET',
      `/api/reports/shifts?from=${reportDate}&to=${reportDate}&communityId=${communityA1Id}`,
      communityAdminA1Token,
    );
    assert.equal(response.statusCode, 200, response.body);
    const body = parse(response);

    assert.equal(body.totals.shifts, 3);
    assert.equal(body.totals.openShifts, 1);
    assert.equal(body.totals.closedShifts, 2);
    assert.equal(body.totals.hours, 6.5);
    assert.equal(body.totals.accesses, 8, 'el acceso sin turno no se atribuye');

    const shifts = Object.fromEntries((body.shifts as Json[]).map((row) => [row.shiftId, row]));
    assert.equal(shifts[closedShiftAId].hours, 4);
    assert.equal(shifts[closedShiftAId].accesses, 7, 'incluye el ingreso por documento');
    assert.equal(shifts[closedShiftBId].hours, 2.5);
    assert.equal(shifts[closedShiftBId].accesses, 1);
    assert.equal(shifts[openShiftCId].status, 'open');
    assert.equal(shifts[openShiftCId].hours, null, 'un turno abierto no son cero horas');

    assert.equal(body.openShifts.length, 1);
    assert.equal(body.openShifts[0].shiftId, openShiftCId);
    assert.equal(body.openShifts[0].guardPersonId, guard1PersonId);
    assert.equal(body.openShifts[0].startedAt, at(13).toISOString());

    const guards = Object.fromEntries(
      (body.guards as Json[]).map((row) => [row.guardPersonId, row]),
    );
    assert.equal(guards[guard1PersonId].shifts, 2);
    assert.equal(guards[guard1PersonId].openShifts, 1);
    assert.equal(guards[guard1PersonId].closedShifts, 1);
    assert.equal(guards[guard1PersonId].hours, 4);
    assert.equal(guards[guard1PersonId].accesses, 7);
    assert.equal(guards[guard2PersonId].hours, 2.5);
    assert.equal(guards[guard2PersonId].accesses, 1);
  });

  it('narrows a community role asking for another community', async () => {
    const access = await request(
      'GET',
      `/api/reports/access?from=${reportDate}&to=${reportDate}&organizationId=${orgBId}&communityId=${communityB1Id}`,
      communityAdminA1Token,
    );
    assert.equal(access.statusCode, 200, access.body);
    assert.equal(parse(access).totals.total, 9, 'sólo ve los accesos de su comunidad');
    assert.equal(parse(access).scope.communityId, communityA1Id);

    const shifts = await request(
      'GET',
      `/api/reports/shifts?from=${reportDate}&to=${reportDate}&organizationId=${orgBId}&communityId=${communityB1Id}`,
      communityAdminA1Token,
    );
    assert.equal(shifts.statusCode, 200, shifts.body);
    assert.equal(parse(shifts).totals.shifts, 3);
    assert.equal(parse(shifts).scope.communityId, communityA1Id);
  });

  it('requires an organization for platform reports and validates the period', async () => {
    const missing = await request(
      'GET',
      `/api/reports/access?from=${reportDate}&to=${reportDate}`,
      platformToken,
    );
    assert.equal(missing.statusCode, 400, missing.body);
    assert.match(String(parse(missing).error), /organizationId/);

    const badDate = await request(
      'GET',
      `/api/reports/access?from=2026-02-31&to=${reportDate}`,
      communityAdminA1Token,
    );
    assert.equal(badDate.statusCode, 400, badDate.body);

    const badGranularity = await request(
      'GET',
      `/api/reports/access?from=${reportDate}&to=${reportDate}&granularity=hour`,
      communityAdminA1Token,
    );
    assert.equal(badGranularity.statusCode, 400, badGranularity.body);
  });

  it('reports the method from the bitacora source, not from pass_scans.origin', async () => {
    const scans = await db
      .select({ origin: passScans.origin })
      .from(passScans)
      .where(eq(passScans.communityId, communityA1Id));
    assert.equal(scans.length, 4);
    assert.equal(
      scans.every((scan) => scan.origin === 'qr'),
      true,
      'todo escaneo de pase es QR',
    );

    const [documentEntry] = await db
      .select({ source: bitacoraEntries.source, passScanId: bitacoraEntries.passScanId })
      .from(bitacoraEntries)
      .where(
        and(
          eq(bitacoraEntries.communityId, communityA1Id),
          eq(bitacoraEntries.source, 'manual_identity'),
        ),
      )
      .limit(1);
    assert.equal(documentEntry.source, 'manual_identity');
    assert.equal(documentEntry.passScanId, null, 'no existe un escaneo para el documento');
  });
});
