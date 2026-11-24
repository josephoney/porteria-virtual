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
  retentionHolds,
  retentionRuns,
} from '@porteria/database/schema';

import { randomToken, sha256Hex } from '../src/lib/pass-tokens.js';
import { PRIVACY_POLICY_VERSION } from '../src/lib/privacy-policy.js';
import {
  anonymizeOrganization,
  createRetentionHold,
  releaseRetentionHold,
  retentionCutoff,
} from '../src/services/retention.service.js';

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
let operatorToken: string;
let consentPassId: string;
let consentLinkToken: string;
/** Instante fuera de la ventana, compartido con los tests. */
let oldDateTime: Date;
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

/** Cookies de una respuesta, listas para acompañar el siguiente pedido. */
function extractCookies(headers: Record<string, unknown>): Record<string, string> {
  const raw = headers['set-cookie'];
  const list = Array.isArray(raw) ? raw : typeof raw === 'string' ? [raw] : [];
  const cookies: Record<string, string> = {};
  for (const item of list) {
    const pair = item.split(';')[0] ?? '';
    const index = pair.indexOf('=');
    if (index <= 0) continue;
    cookies[pair.slice(0, index)] = pair.slice(index + 1);
  }
  return cookies;
}

/** Pedido al portal público, que se identifica con cookies y no con un token. */
async function publicRequest(
  method: 'GET' | 'POST',
  url: string,
  options: { cookies?: Record<string, string>; payload?: Record<string, unknown> } = {},
) {
  const cookie = options.cookies
    ? Object.entries(options.cookies)
        .map(([name, value]) => `${name}=${value}`)
        .join('; ')
    : '';
  return app.inject({
    method,
    url,
    ...(cookie ? { headers: { cookie } } : {}),
    ...(options.payload ? { payload: options.payload } : {}),
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
    // El operador de portería ve el nombre, pero no el documento.
    operatorToken = app.jwt.sign({
      sub: adminAccountId,
      email: `operador-retencion-${suffix}@test.local`,
      accountId: adminAccountId,
      personId: adminPersonId,
      orgId: orgAId,
      membershipId: adminMembershipId,
      role: 'operator',
      communityId: communityAId,
      unitId: null,
      isPlatformAdmin: false,
    });

    // Fuera de la ventana de treinta días: cuarenta y cinco días atrás.
    const cutoff = retentionCutoff(30);
    const oldValidity = daysBefore(cutoff, 15);
    oldDateTime = oldValidity;

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

    // Pase con token conocido para recorrer el consentimiento público.
    consentLinkToken = randomToken();
    const [consentPass] = await db
      .insert(accessPasses)
      .values({
        type: 'entry_exit',
        maxUses: 10,
        communityId: communityAId,
        structureId: structureAId,
        locationUnitId: unitAId,
        createdByPersonId: residentPersonId,
        authorizedByPersonId: residentPersonId,
        visitorFirstName: 'Visitante',
        visitorLastName: 'Consentimiento',
        visitorDocument: 'DOC-CONSENT',
        validFrom: new Date(),
        validUntil: new Date(Date.now() + 86_400_000),
        linkTokenHash: sha256Hex(consentLinkToken),
        linkExpiresAt: new Date(Date.now() + 86_400_000),
      })
      .returning();
    consentPassId = consentPass.id;

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
          summary: 'Ingresó Visitante Antiguo',
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
    await db.delete(retentionHolds).where(inArray(retentionHolds.organizationId, [orgAId, orgBId]));
    const communityIds = [communityAId, communityBId];
    await db.delete(retentionRuns).where(inArray(retentionRuns.organizationId, [orgAId, orgBId]));
    await db.delete(bitacoraEntries).where(inArray(bitacoraEntries.communityId, communityIds));
    await db.delete(passScans).where(inArray(passScans.communityId, communityIds));
    await db
      .delete(accessPasses)
      .where(inArray(accessPasses.id, [oldPassAId, newPassAId, oldPassBId, consentPassId]));
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
    const outcome = await anonymizeOrganization(orgAId, 30, { dryRun: true });

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
    assert.equal(runs[0].retentionDays, 30);
    assert.equal(runs[0].anonymizedPasses, 1);
  });

  it('preserva el rango de una investigación abierta', async () => {
    const hold = await createRetentionHold({
      organizationId: orgAId,
      communityId: null,
      fromDate: localDateString(daysBefore(oldDateTime, 5)),
      toDate: localDateString(daysBefore(oldDateTime, -5)),
      reason: 'Investigación de un incidente en portería',
      createdByPersonId: adminPersonId,
      expiresAt: new Date(Date.now() + 7 * 86_400_000),
    });

    const outcome = await anonymizeOrganization(orgAId, 30, { dryRun: false });
    assert.equal(outcome.passes, 0);
    assert.equal(outcome.scans, 0);
    assert.equal(outcome.entries, 0);
    assert.ok(outcome.preserved >= 3);

    const [pass] = await db
      .select()
      .from(accessPasses)
      .where(eq(accessPasses.id, oldPassAId))
      .limit(1);
    assert.equal(pass.visitorDocument, 'DOC-ANTIGUO-A');

    // Liberar la preservación vuelve a dejar el rango en manos de la ventana:
    // el test siguiente comprueba que ya se anonimiza.
    const released = await releaseRetentionHold(orgAId, hold.id, adminPersonId);
    assert.ok(released?.releasedAt);
  });

  it('anonimiza sólo lo que está fuera de la ventana', async () => {
    const outcome = await anonymizeOrganization(orgAId, 30, { dryRun: false });
    assert.equal(outcome.passes, 1);
    assert.equal(outcome.scans, 1);
    assert.equal(outcome.entries, 1);

    const [oldPass, newPass] = await Promise.all([
      db.select().from(accessPasses).where(eq(accessPasses.id, oldPassAId)).limit(1),
      db.select().from(accessPasses).where(eq(accessPasses.id, newPassAId)).limit(1),
    ]);
    assert.equal(oldPass[0].visitorFirstName, 'Visitante');
    assert.equal(oldPass[0].visitorLastName, 'Antiguo');
    assert.equal(oldPass[0].visitorDocument, 'ANONIMIZADO');
    // El resto del registro se conserva: es la constancia de a quién se autorizó.
    assert.equal(oldPass[0].vehiclePlate, 'ABC123');
    assert.equal(oldPass[0].hasVehicle, true);
    assert.equal(newPass[0].visitorDocument, 'DOC-RECIENTE-A');

    const [oldScan, newScan] = await Promise.all([
      db.select().from(passScans).where(eq(passScans.id, oldScanAId)).limit(1),
      db.select().from(passScans).where(eq(passScans.id, newScanAId)).limit(1),
    ]);
    assert.equal(oldScan[0].visitorDocument, 'ANONIMIZADO');
    assert.equal(oldScan[0].visitorFirstName, 'Visitante');
    assert.equal(newScan[0].visitorDocument, 'DOC-ESCANEO');

    const [oldEntry, newEntry] = await Promise.all([
      db.select().from(bitacoraEntries).where(eq(bitacoraEntries.id, oldEntryAId)).limit(1),
      db.select().from(bitacoraEntries).where(eq(bitacoraEntries.id, newEntryAId)).limit(1),
    ]);
    const oldDetails = oldEntry[0].details as Record<string, unknown>;
    // La bitácora es el registro operativo de la comunidad: pasada la ventana
    // pierde al visitante completo, pero conserva a quien lo autorizó.
    assert.equal(oldDetails.visitor, undefined);
    assert.equal(oldDetails.companions, undefined);
    assert.equal(oldDetails.vehiclePlate, undefined);
    assert.equal(oldDetails.action, 'entry');
    assert.equal(oldEntry[0].authorizedByName, 'Guardia Antiguo');
    // El resumen llevaba el nombre y pasa al marcador genérico.
    assert.equal(oldEntry[0].summary, 'Acceso anonimizado');
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

  it('muestra el documento completo al administrador y lo enmascara al operador', async () => {
    const asOperator = await request('GET', `/api/bitacora/${newEntryAId}`, operatorToken);
    assert.equal(asOperator.statusCode, 200);
    const operatorDetails = JSON.parse(asOperator.body).details as {
      visitor?: { document?: string };
    };
    assert.equal(operatorDetails.visitor?.document, '***TE-A');

    const asAdmin = await request('GET', `/api/bitacora/${newEntryAId}`, adminToken);
    assert.equal(asAdmin.statusCode, 200);
    const adminDetails = JSON.parse(asAdmin.body).details as {
      visitor?: { document?: string };
    };
    assert.equal(adminDetails.visitor?.document, 'DOC-RECIENTE-A');
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
    const outcome = await anonymizeOrganization(orgAId, 30, { dryRun: false });
    assert.equal(outcome.passes, 0);
    assert.equal(outcome.scans, 0);
    assert.equal(outcome.entries, 0);
  });

  it('rechaza una ventana fuera de rango y guarda la elegida', async () => {
    for (const invalid of [0, 45, 61, 2.5]) {
      const response = await request('PATCH', '/api/organizations/me', adminToken, {
        retentionDays: invalid,
      });
      assert.equal(response.statusCode, 400);
    }

    const accepted = await request('PATCH', '/api/organizations/me', adminToken, {
      retentionDays: 90,
    });
    assert.equal(accepted.statusCode, 200);
    assert.equal(JSON.parse(accepted.body).retentionDays, 90);
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

  it('exige el consentimiento antes de entregar el QR público', async () => {
    const preview = await publicRequest('GET', `/api/public/passes/${consentLinkToken}`);
    assert.equal(preview.statusCode, 200);
    assert.equal(JSON.parse(preview.body).consent.accepted, false);

    const bound = await publicRequest('POST', `/api/public/passes/${consentLinkToken}/bind`, {
      payload: {},
    });
    assert.equal(bound.statusCode, 200);
    const cookies = extractCookies(bound.headers);

    const blocked = await publicRequest('GET', `/api/public/passes/${consentLinkToken}/qr`, {
      cookies,
    });
    assert.equal(blocked.statusCode, 400);
    assert.equal(JSON.parse(blocked.body).message, 'consent_required');

    const accepted = await publicRequest('POST', `/api/public/passes/${consentLinkToken}/consent`, {
      cookies,
    });
    assert.equal(accepted.statusCode, 200);

    const [pass] = await db
      .select()
      .from(accessPasses)
      .where(eq(accessPasses.id, consentPassId))
      .limit(1);
    assert.ok(pass.consentAcceptedAt);
    assert.equal(pass.consentPolicyVersion, PRIVACY_POLICY_VERSION);
    assert.equal(pass.consentMode, 'link');
    assert.ok(pass.consentIp);

    const qr = await publicRequest('GET', `/api/public/passes/${consentLinkToken}/qr`, { cookies });
    assert.equal(qr.statusCode, 200);
    assert.ok(JSON.parse(qr.body).token);

    // Aceptar dos veces no reescribe la fecha: la prueba es la primera.
    const again = await publicRequest('POST', `/api/public/passes/${consentLinkToken}/consent`, {
      cookies,
    });
    assert.equal(again.statusCode, 200);
    assert.equal(JSON.parse(again.body).acceptedAt, pass.consentAcceptedAt?.toISOString());
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
