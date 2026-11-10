import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { createDb } from '@porteria/database';
import {
  accessPasses,
  accessPoints,
  communities,
  guardShiftSegments,
  guardShifts,
  memberships,
  passAlerts,
  passScans,
  people,
} from '@porteria/database/schema';
import { createEventEnvelope } from '@porteria/shared';
import type {
  PassStatus,
  ScanAction,
  ScanDecisionResponse,
  ScanPassResponse,
  ScanStatus,
} from '@porteria/shared';
import config from '../config.js';
import { insertBitacoraEntry } from './bitacora.service.js';
import { buildLocationPath } from './location-path.service.js';
import { enqueueEvent } from './outbox.service.js';
import type { PassResult } from './pass-errors.js';
import { verifyPassQrToken } from './pass-qr-token.service.js';
import type { PassRequester } from './pass.service.js';

const db = createDb();

type AccessPassRow = typeof accessPasses.$inferSelect;
type PassScanRow = typeof passScans.$inferSelect;

export interface ScanListQuery {
  page: number;
  pageSize: number;
  status?: ScanStatus;
  action?: ScanAction;
}

export interface ScanListResult {
  items: Array<PassScanRow & { locationPath: string }>;
  page: number;
  pageSize: number;
  total: number;
}

interface ShiftContext {
  shiftId: string;
  accessPointId: string;
  accessPointName: string;
  direction: 'entry' | 'exit' | 'both';
  communityId: string;
}

async function resolvePersonId(requester: PassRequester): Promise<string | null> {
  if (requester.personId) return requester.personId;
  if (!requester.membershipId || requester.membershipId === 'platform') return null;
  const [row] = await db
    .select({ personId: memberships.personId })
    .from(memberships)
    .where(eq(memberships.id, requester.membershipId))
    .limit(1);
  return row?.personId ?? null;
}

async function loadPass(passId: string): Promise<AccessPassRow | null> {
  const [row] = await db.select().from(accessPasses).where(eq(accessPasses.id, passId)).limit(1);
  return row ?? null;
}

async function loadTimezone(communityId: string): Promise<string> {
  const [row] = await db
    .select({ timezone: communities.timezone })
    .from(communities)
    .where(eq(communities.id, communityId))
    .limit(1);
  return row?.timezone ?? 'UTC';
}

async function loadAuthorizerName(personId: string): Promise<string> {
  const [row] = await db
    .select({ firstName: people.firstName, lastName: people.lastName })
    .from(people)
    .where(eq(people.id, personId))
    .limit(1);
  return row ? `${row.firstName} ${row.lastName}`.trim() : '';
}

function toVisitor(pass: AccessPassRow) {
  return {
    firstName: pass.visitorFirstName,
    lastName: pass.visitorLastName,
    document: pass.visitorDocument,
  };
}

function toSchedule(pass: AccessPassRow) {
  return {
    validFrom: pass.validFrom.toISOString(),
    validUntil: pass.validUntil.toISOString(),
    timeFrom: pass.timeFrom,
    timeTo: pass.timeTo,
  };
}

function isInsideSchedule(pass: AccessPassRow, timezone: string, now: Date): boolean {
  if (now < pass.validFrom || now > pass.validUntil) return false;
  if (!pass.timeFrom || !pass.timeTo) return true;
  const local = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(now);
  const from = pass.timeFrom.slice(0, 5);
  const to = pass.timeTo.slice(0, 5);
  return local >= from && local <= to;
}

async function loadOpenShiftContext(personId: string): Promise<ShiftContext | null> {
  const [row] = await db
    .select({
      shiftId: guardShifts.id,
      communityId: guardShifts.communityId,
      accessPointId: accessPoints.id,
      accessPointName: accessPoints.name,
      direction: accessPoints.direction,
    })
    .from(guardShifts)
    .innerJoin(
      guardShiftSegments,
      and(eq(guardShiftSegments.shiftId, guardShifts.id), isNull(guardShiftSegments.endedAt)),
    )
    .innerJoin(accessPoints, eq(guardShiftSegments.accessPointId, accessPoints.id))
    .where(and(eq(guardShifts.guardPersonId, personId), eq(guardShifts.status, 'open')))
    .limit(1);
  return row ?? null;
}

async function loadOpenShiftContextAt(
  personId: string,
  accessPointId: string,
): Promise<ShiftContext | null> {
  const [row] = await db
    .select({
      shiftId: guardShifts.id,
      communityId: guardShifts.communityId,
      accessPointId: accessPoints.id,
      accessPointName: accessPoints.name,
      direction: accessPoints.direction,
    })
    .from(guardShifts)
    .innerJoin(
      guardShiftSegments,
      and(eq(guardShiftSegments.shiftId, guardShifts.id), isNull(guardShiftSegments.endedAt)),
    )
    .innerJoin(accessPoints, eq(guardShiftSegments.accessPointId, accessPoints.id))
    .where(
      and(
        eq(guardShifts.guardPersonId, personId),
        eq(guardShifts.status, 'open'),
        eq(accessPoints.id, accessPointId),
      ),
    )
    .limit(1);
  return row ?? null;
}

function deniedResponse(
  pass: AccessPassRow,
  action: ScanAction,
  reason: string,
  locationPath: string,
  authorizedByName: string,
  context: ShiftContext,
  bitacoraEntryId: string | null,
): ScanPassResponse {
  return {
    scanId: null,
    authorized: false,
    action,
    result: 'denied',
    reason,
    visitor: toVisitor(pass),
    vehiclePlate: pass.vehiclePlate,
    locationPath,
    authorizedByName,
    schedule: toSchedule(pass),
    presenceState: pass.presenceState,
    status: null,
    accessPointId: context.accessPointId,
    accessPointName: context.accessPointName,
    shiftId: context.shiftId,
    bitacoraEntryId,
  };
}

async function writeDeniedEntry(
  requester: PassRequester,
  personId: string,
  context: ShiftContext,
  pass: AccessPassRow | null,
  action: ScanAction | null,
  reason: string,
  details: Record<string, unknown> = {},
): Promise<string | null> {
  try {
    const row = await insertBitacoraEntry(db, {
      communityId: context.communityId,
      accessPointId: context.accessPointId,
      accessPointName: context.accessPointName,
      shiftId: context.shiftId,
      type: 'scan_denied',
      source: 'app',
      authorPersonId: personId,
      authorAccountId: requester.accountId ?? null,
      passId: pass?.id ?? null,
      summary: `Escaneo denegado: ${reason}`,
      details: {
        reason,
        action,
        ...(pass
          ? {
              visitor: toVisitor(pass),
              vehiclePlate: pass.vehiclePlate,
            }
          : {}),
        ...details,
      },
    });
    return row.id;
  } catch {
    return null;
  }
}

export async function scanPass(
  requester: PassRequester,
  token: string,
): Promise<PassResult<ScanPassResponse>> {
  const personId = await resolvePersonId(requester);
  if (!personId) return { ok: false, code: 'forbidden' };

  const context = await loadOpenShiftContext(personId);
  if (!context) return { ok: false, code: 'no_active_shift' };

  let payload: ReturnType<typeof verifyPassQrToken>;
  try {
    payload = verifyPassQrToken(token);
  } catch {
    await writeDeniedEntry(requester, personId, context, null, null, 'invalid_or_expired_token');
    return { ok: false, code: 'invalid_or_expired_token' };
  }

  const pass = await loadPass(payload.passId);
  if (!pass) {
    await writeDeniedEntry(requester, personId, context, null, null, 'invalid_or_expired_token', {
      tokenJti: payload.jti,
    });
    return { ok: false, code: 'invalid_or_expired_token' };
  }

  if (pass.communityId !== context.communityId) {
    await writeDeniedEntry(requester, personId, context, pass, null, 'foreign_community', {
      tokenJti: payload.jti,
    });
    return { ok: false, code: 'foreign_community' };
  }

  const now = new Date();
  const action: ScanAction = pass.presenceState === 'inside' ? 'exit' : 'entry';
  const timezone = await loadTimezone(pass.communityId);
  const locationPath = (await buildLocationPath(pass.locationUnitId)) ?? '';
  const authorizedByName = await loadAuthorizerName(pass.authorizedByPersonId);

  const denied = async (reason: string) => {
    const entryId = await writeDeniedEntry(requester, personId, context, pass, action, reason, {
      tokenJti: payload.jti,
    });
    return {
      ok: true as const,
      data: deniedResponse(pass, action, reason, locationPath, authorizedByName, context, entryId),
    };
  };

  if (context.direction !== 'both' && context.direction !== action) {
    return denied('wrong_direction');
  }
  if (pass.status === 'used') return denied('pass_used');
  if (pass.status === 'revoked') return denied('revoked');
  if (pass.status === 'expired' || now > pass.validUntil) {
    if (action !== 'exit') return denied('expired');
  }
  if (action === 'entry' && !isInsideSchedule(pass, timezone, now)) {
    return denied('out_of_schedule');
  }

  let scan: PassScanRow;
  try {
    const [inserted] = await db
      .insert(passScans)
      .values({
        passId: pass.id,
        guardPersonId: personId,
        guardAccountId: requester.accountId ?? null,
        communityId: pass.communityId,
        locationUnitId: pass.locationUnitId,
        structureId: pass.structureId,
        visitorFirstName: pass.visitorFirstName,
        visitorLastName: pass.visitorLastName,
        visitorDocument: pass.visitorDocument,
        vehiclePlate: pass.vehiclePlate,
        action,
        result: 'authorized',
        tokenJti: payload.jti,
        status: 'pending',
        scannedAt: now,
        shiftId: context.shiftId,
        accessPointId: context.accessPointId,
        accessPointName: context.accessPointName,
      })
      .returning();
    scan = inserted;
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') {
      await writeDeniedEntry(requester, personId, context, pass, action, 'token_already_used', {
        tokenJti: payload.jti,
      });
      return { ok: false, code: 'token_already_used' };
    }
    throw error;
  }

  return {
    ok: true,
    data: {
      scanId: scan.id,
      authorized: true,
      action,
      result: 'authorized',
      reason: null,
      visitor: toVisitor(pass),
      vehiclePlate: pass.vehiclePlate,
      locationPath,
      authorizedByName,
      schedule: toSchedule(pass),
      presenceState: pass.presenceState,
      status: 'pending',
      accessPointId: context.accessPointId,
      accessPointName: context.accessPointName,
      shiftId: context.shiftId,
      bitacoraEntryId: null,
    },
  };
}

export async function confirmScan(
  requester: PassRequester,
  scanId: string,
): Promise<PassResult<ScanDecisionResponse>> {
  const [scan] = await db.select().from(passScans).where(eq(passScans.id, scanId)).limit(1);
  if (!scan) return { ok: false, code: 'not_found' };
  if (scan.status !== 'pending') return { ok: false, code: 'scan_already_processed' };

  const personId = await resolvePersonId(requester);
  if (!personId) return { ok: false, code: 'forbidden' };

  const context = scan.accessPointId
    ? await loadOpenShiftContextAt(personId, scan.accessPointId)
    : await loadOpenShiftContext(personId);
  if (!context) {
    const hasShift = await loadOpenShiftContext(personId);
    return { ok: false, code: hasShift ? 'not_on_shift_at_access_point' : 'no_active_shift' };
  }

  const now = new Date();
  if (now.getTime() - scan.scannedAt.getTime() > config.passes.scanPendingTtlSeconds * 1000) {
    const [expired] = await db
      .update(passScans)
      .set({ status: 'expired' })
      .where(and(eq(passScans.id, scanId), eq(passScans.status, 'pending')))
      .returning();
    if (!expired) return { ok: false, code: 'scan_already_processed' };
    await writeDeniedEntry(requester, personId, context, null, null, 'scan_expired');
    return { ok: false, code: 'scan_expired' };
  }

  const [pass] = await db
    .select()
    .from(accessPasses)
    .where(eq(accessPasses.id, scan.passId))
    .limit(1);
  if (!pass) return { ok: false, code: 'not_found' };

  if (pass.status === 'used' || pass.status === 'revoked') {
    await writeDeniedEntry(requester, personId, context, pass, scan.action, 'pass_expired');
    return { ok: false, code: 'pass_expired' };
  }
  if (pass.status === 'expired' && scan.action !== 'exit') {
    await writeDeniedEntry(requester, personId, context, pass, scan.action, 'pass_expired');
    return { ok: false, code: 'pass_expired' };
  }

  const nextPresence = scan.action === 'entry' ? 'inside' : 'outside';
  const nextStatus: PassStatus =
    scan.action === 'entry'
      ? pass.type === 'entry_only'
        ? 'used'
        : pass.status
      : pass.type === 'entry_only' || pass.type === 'entry_exit'
        ? 'used'
        : 'active';

  let bitacoraEntryId: string | null = null;

  try {
    await db.transaction(async (tx) => {
      const [updatedScan] = await tx
        .update(passScans)
        .set({
          status: 'confirmed',
          confirmedAt: now,
          result: 'authorized',
          confirmedByPersonId: personId,
          confirmedByAccountId: requester.accountId ?? null,
          ...(scan.accessPointId
            ? {}
            : {
                accessPointId: context.accessPointId,
                accessPointName: context.accessPointName,
                shiftId: context.shiftId,
              }),
        })
        .where(and(eq(passScans.id, scanId), eq(passScans.status, 'pending')))
        .returning();
      if (!updatedScan) throw new Error('scan_already_processed');

      if (scan.action === 'entry') {
        await tx
          .update(accessPasses)
          .set({
            presenceState: 'inside',
            entryAt: now,
            entryCount: sql`${accessPasses.entryCount} + 1`,
            status: nextStatus,
            updatedAt: now,
          })
          .where(eq(accessPasses.id, pass.id));
      } else {
        await tx
          .update(accessPasses)
          .set({
            presenceState: 'outside',
            exitAt: now,
            exitCount: sql`${accessPasses.exitCount} + 1`,
            status: nextStatus,
            updatedAt: now,
          })
          .where(eq(accessPasses.id, pass.id));

        await tx
          .update(passAlerts)
          .set({ status: 'resolved', resolvedAt: now, resolvedByPersonId: personId })
          .where(and(eq(passAlerts.passId, pass.id), eq(passAlerts.status, 'open')));
      }

      await enqueueEvent(
        tx,
        createEventEnvelope({
          eventType: scan.action === 'entry' ? 'pass.entry' : 'pass.exit',
          organizationId: requester.orgId,
          communityId: pass.communityId,
          actorId: requester.sub,
          actorRole: requester.role,
          payload: { passId: pass.id, scanId, action: scan.action },
        }),
      );

      const entry = await insertBitacoraEntry(tx, {
        communityId: context.communityId,
        accessPointId: context.accessPointId,
        accessPointName: context.accessPointName,
        shiftId: context.shiftId,
        type: scan.action === 'entry' ? 'pass_entry' : 'pass_exit',
        source: 'app',
        authorPersonId: personId,
        authorAccountId: requester.accountId ?? null,
        passId: pass.id,
        passScanId: scanId,
        summary:
          scan.action === 'entry'
            ? `Ingreso de ${pass.visitorFirstName} ${pass.visitorLastName}`
            : `Egreso de ${pass.visitorFirstName} ${pass.visitorLastName}`,
        details: {
          action: scan.action,
          visitor: toVisitor(pass),
          vehiclePlate: pass.vehiclePlate,
          locationUnitId: pass.locationUnitId,
          structureId: pass.structureId,
          authorizedByPersonId: pass.authorizedByPersonId,
          locationPath: (await buildLocationPath(pass.locationUnitId)) ?? '',
        },
      });
      bitacoraEntryId = entry.id;
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'scan_already_processed') {
      return { ok: false, code: 'scan_already_processed' };
    }
    throw error;
  }

  return {
    ok: true,
    data: {
      scanId,
      status: 'confirmed',
      action: scan.action,
      passStatus: nextStatus,
      presenceState: nextPresence,
      bitacoraEntryId,
    },
  };
}

export async function rejectScan(
  requester: PassRequester,
  scanId: string,
  reason?: string,
): Promise<PassResult<ScanDecisionResponse>> {
  const [scan] = await db.select().from(passScans).where(eq(passScans.id, scanId)).limit(1);
  if (!scan) return { ok: false, code: 'not_found' };

  const [pass] = await db
    .select()
    .from(accessPasses)
    .where(eq(accessPasses.id, scan.passId))
    .limit(1);
  if (!pass) return { ok: false, code: 'not_found' };

  const personId = await resolvePersonId(requester);
  if (!personId) return { ok: false, code: 'forbidden' };

  const context = scan.accessPointId
    ? await loadOpenShiftContextAt(personId, scan.accessPointId)
    : await loadOpenShiftContext(personId);
  if (!context) {
    const hasShift = await loadOpenShiftContext(personId);
    return { ok: false, code: hasShift ? 'not_on_shift_at_access_point' : 'no_active_shift' };
  }

  let bitacoraEntryId: string | null = null;

  try {
    await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(passScans)
        .set({
          status: 'rejected',
          confirmedAt: new Date(),
          reason: reason ?? null,
          confirmedByPersonId: personId,
          confirmedByAccountId: requester.accountId ?? null,
        })
        .where(and(eq(passScans.id, scanId), eq(passScans.status, 'pending')))
        .returning();
      if (!updated) throw new Error('scan_already_processed');

      await enqueueEvent(
        tx,
        createEventEnvelope({
          eventType: 'pass.rejected',
          organizationId: requester.orgId,
          communityId: pass.communityId,
          actorId: requester.sub,
          actorRole: requester.role,
          payload: { passId: pass.id, scanId, reason: reason ?? null },
        }),
      );

      const entry = await insertBitacoraEntry(tx, {
        communityId: context.communityId,
        accessPointId: context.accessPointId,
        accessPointName: context.accessPointName,
        shiftId: context.shiftId,
        type: 'pass_rejected',
        source: 'app',
        authorPersonId: personId,
        authorAccountId: requester.accountId ?? null,
        passId: pass.id,
        passScanId: scanId,
        summary: `Ingreso rechazado: ${pass.visitorFirstName} ${pass.visitorLastName}`,
        details: {
          reason: reason ?? null,
          action: scan.action,
          visitor: toVisitor(pass),
          vehiclePlate: pass.vehiclePlate,
          locationPath: (await buildLocationPath(pass.locationUnitId)) ?? '',
        },
      });
      bitacoraEntryId = entry.id;
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'scan_already_processed') {
      return { ok: false, code: 'scan_already_processed' };
    }
    throw error;
  }

  return {
    ok: true,
    data: {
      scanId,
      status: 'rejected',
      action: scan.action,
      passStatus: pass.status,
      presenceState: pass.presenceState,
      bitacoraEntryId,
    },
  };
}

export async function listScans(
  requester: PassRequester,
  query: ScanListQuery,
): Promise<PassResult<ScanListResult>> {
  const personId = await resolvePersonId(requester);
  if (!personId) return { ok: false, code: 'forbidden' };

  const filters = [eq(passScans.guardPersonId, personId)];
  if (query.status) filters.push(eq(passScans.status, query.status));
  if (query.action) filters.push(eq(passScans.action, query.action));
  const where = and(...filters);

  const [countRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(passScans)
    .where(where);

  const rows = await db
    .select()
    .from(passScans)
    .where(where)
    .orderBy(desc(passScans.scannedAt))
    .limit(query.pageSize)
    .offset((query.page - 1) * query.pageSize);

  const paths = new Map<string, string>();
  for (const row of rows) {
    if (!paths.has(row.locationUnitId)) {
      paths.set(row.locationUnitId, (await buildLocationPath(row.locationUnitId)) ?? '');
    }
  }

  return {
    ok: true,
    data: {
      items: rows.map((row) => ({ ...row, locationPath: paths.get(row.locationUnitId) ?? '' })),
      page: query.page,
      pageSize: query.pageSize,
      total: Number(countRow?.count ?? 0),
    },
  };
}
