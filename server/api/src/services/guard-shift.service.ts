import { and, count, desc, eq, inArray, isNull } from 'drizzle-orm';
import { createDb } from '@porteria/database';
import {
  accessPoints,
  accounts,
  communities,
  guardShiftSegments,
  guardShifts,
  memberships,
  people,
} from '@porteria/database/schema';
import type {
  AccessPoint,
  ChangeAccessPointDto,
  EndShiftDto,
  ForceCloseShiftDto,
  GuardShift,
  GuardShiftCurrentResponse,
  GuardShiftDto,
  GuardShiftHistoryItem,
  GuardShiftListResponse,
  GuardShiftSegment,
  GuardShiftSegmentDto,
  StartShiftDto,
} from '@porteria/shared';
import config from '../config.js';
import { insertBitacoraEntry } from './bitacora.service.js';

const db = createDb();

export interface GuardShiftRequester {
  sub: string;
  accountId?: string;
  personId?: string;
  role: string;
  orgId: string;
  communityId: string | null;
  membershipId: string;
  isPlatformAdmin: boolean;
}

export type GuardShiftResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: 'not_found' | 'forbidden' | 'invalid' | 'conflict' };

interface GuardContext {
  personId: string;
  accountId: string | null;
  communityId: string;
}

function toGuardShift(row: typeof guardShifts.$inferSelect): GuardShift {
  return {
    id: row.id,
    communityId: row.communityId,
    guardPersonId: row.guardPersonId,
    guardAccountId: row.guardAccountId,
    status: row.status,
    startedAt: row.startedAt,
    endedAt: row.endedAt,
    endedByPersonId: row.endedByPersonId,
    closedReason: row.closedReason,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toSegment(row: typeof guardShiftSegments.$inferSelect): GuardShiftSegment {
  return {
    id: row.id,
    shiftId: row.shiftId,
    accessPointId: row.accessPointId,
    startedAt: row.startedAt,
    endedAt: row.endedAt,
    endReason: row.endReason,
    createdAt: row.createdAt,
  };
}

function toAccessPoint(row: typeof accessPoints.$inferSelect): AccessPoint {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    gpioPin: row.gpioPin,
    communityId: row.communityId,
    kioskId: null,
    failPolicy: row.failPolicy,
    direction: row.direction,
    active: row.active,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function shiftDto(
  row: typeof guardShifts.$inferSelect,
  accessPointName: string | null,
): GuardShiftDto {
  return { ...toGuardShift(row), accessPointName };
}

function segmentDto(
  row: typeof guardShiftSegments.$inferSelect,
  accessPointName: string,
): GuardShiftSegmentDto {
  return { ...toSegment(row), accessPointName };
}

async function resolveContext(requester: GuardShiftRequester): Promise<GuardContext | null> {
  if (requester.role !== 'guard') return null;
  if (!requester.communityId) return null;

  let personId = requester.personId ?? null;
  if (!personId && requester.membershipId && requester.membershipId !== 'platform') {
    const [row] = await db
      .select({ personId: memberships.personId })
      .from(memberships)
      .where(eq(memberships.id, requester.membershipId))
      .limit(1);
    personId = row?.personId ?? null;
  }
  if (!personId) return null;

  return {
    personId,
    accountId: requester.accountId ?? null,
    communityId: requester.communityId,
  };
}

async function loadDefaultAccessPoint(
  personId: string,
  communityId: string,
): Promise<string | null> {
  const [row] = await db
    .select({ defaultAccessPointId: memberships.defaultAccessPointId })
    .from(memberships)
    .where(
      and(
        eq(memberships.personId, personId),
        eq(memberships.communityId, communityId),
        eq(memberships.role, 'guard'),
        eq(memberships.status, 'active'),
      ),
    )
    .limit(1);
  return row?.defaultAccessPointId ?? null;
}

async function loadAccessPoint(accessPointId: string) {
  const [row] = await db
    .select()
    .from(accessPoints)
    .where(eq(accessPoints.id, accessPointId))
    .limit(1);
  return row ?? null;
}

async function openShiftFor(personId: string) {
  const [row] = await db
    .select()
    .from(guardShifts)
    .where(and(eq(guardShifts.guardPersonId, personId), eq(guardShifts.status, 'open')))
    .limit(1);
  return row ?? null;
}

async function openSegmentFor(shiftId: string) {
  const [row] = await db
    .select()
    .from(guardShiftSegments)
    .where(and(eq(guardShiftSegments.shiftId, shiftId), isNull(guardShiftSegments.endedAt)))
    .limit(1);
  return row ?? null;
}

async function currentResponse(context: GuardContext): Promise<GuardShiftCurrentResponse> {
  const shift = await openShiftFor(context.personId);
  if (!shift) {
    return {
      shift: null,
      segment: null,
      accessPoint: null,
      stale: false,
      elapsedSeconds: 0,
    };
  }

  const segment = await openSegmentFor(shift.id);
  const accessPoint = segment ? await loadAccessPoint(segment.accessPointId) : null;
  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - shift.startedAt.getTime()) / 1000));
  const stale = elapsedSeconds > config.guardShifts.maxHours * 3600;

  return {
    shift: shiftDto(shift, accessPoint?.name ?? null),
    segment: segment && accessPoint ? segmentDto(segment, accessPoint.name) : null,
    accessPoint: accessPoint ? toAccessPoint(accessPoint) : null,
    stale,
    elapsedSeconds,
  };
}

export async function getCurrentShift(
  requester: GuardShiftRequester,
): Promise<GuardShiftResult<GuardShiftCurrentResponse>> {
  const context = await resolveContext(requester);
  if (!context) return { ok: false, code: 'forbidden' };
  return { ok: true, data: await currentResponse(context) };
}

export async function startShift(
  requester: GuardShiftRequester,
  input: StartShiftDto,
): Promise<GuardShiftResult<GuardShiftCurrentResponse>> {
  const context = await resolveContext(requester);
  if (!context) return { ok: false, code: 'forbidden' };

  const existing = await currentResponse(context);
  if (existing.shift) return { ok: true, data: existing };

  const accessPointId =
    input.accessPointId ?? (await loadDefaultAccessPoint(context.personId, context.communityId));
  if (!accessPointId) return { ok: false, code: 'invalid' };

  const accessPoint = await loadAccessPoint(accessPointId);
  if (!accessPoint) return { ok: false, code: 'not_found' };
  if (accessPoint.communityId !== context.communityId) return { ok: false, code: 'forbidden' };
  if (!accessPoint.active) return { ok: false, code: 'invalid' };

  try {
    await db.transaction(async (tx) => {
      const [shift] = await tx
        .insert(guardShifts)
        .values({
          communityId: context.communityId,
          guardPersonId: context.personId,
          guardAccountId: context.accountId,
          status: 'open',
        })
        .returning();

      await tx.insert(guardShiftSegments).values({
        shiftId: shift.id,
        accessPointId: accessPoint.id,
      });

      await insertBitacoraEntry(tx, {
        communityId: context.communityId,
        accessPointId: accessPoint.id,
        accessPointName: accessPoint.name,
        shiftId: shift.id,
        type: 'shift_start',
        source: input.source ?? 'app',
        authorPersonId: context.personId,
        authorAccountId: context.accountId,
        summary: `Turno iniciado en ${accessPoint.name}`,
        details: { accessPointId: accessPoint.id, accessPointName: accessPoint.name },
      });
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { ok: true, data: await currentResponse(context) };
    }
    throw error;
  }

  return { ok: true, data: await currentResponse(context) };
}

export async function changeAccessPoint(
  requester: GuardShiftRequester,
  shiftId: string,
  input: ChangeAccessPointDto,
): Promise<GuardShiftResult<GuardShiftCurrentResponse>> {
  const context = await resolveContext(requester);
  if (!context) return { ok: false, code: 'forbidden' };

  const [shift] = await db
    .select()
    .from(guardShifts)
    .where(
      and(
        eq(guardShifts.id, shiftId),
        eq(guardShifts.guardPersonId, context.personId),
        eq(guardShifts.status, 'open'),
      ),
    )
    .limit(1);
  if (!shift) return { ok: false, code: 'not_found' };

  const currentSegment = await openSegmentFor(shift.id);
  if (!currentSegment) return { ok: false, code: 'conflict' };
  if (currentSegment.accessPointId === input.accessPointId) {
    return { ok: true, data: await currentResponse(context) };
  }

  const previousAccessPoint = await loadAccessPoint(currentSegment.accessPointId);
  if (!previousAccessPoint) return { ok: false, code: 'not_found' };

  const nextAccessPoint = await loadAccessPoint(input.accessPointId);
  if (!nextAccessPoint) return { ok: false, code: 'not_found' };
  if (nextAccessPoint.communityId !== context.communityId) {
    return { ok: false, code: 'forbidden' };
  }
  if (!nextAccessPoint.active) return { ok: false, code: 'invalid' };

  const source = input.source ?? 'app';

  await db.transaction(async (tx) => {
    await tx
      .update(guardShiftSegments)
      .set({ endedAt: new Date(), endReason: 'reassigned' })
      .where(and(eq(guardShiftSegments.id, currentSegment.id), isNull(guardShiftSegments.endedAt)));

    await tx.insert(guardShiftSegments).values({
      shiftId: shift.id,
      accessPointId: nextAccessPoint.id,
    });

    await insertBitacoraEntry(tx, {
      communityId: context.communityId,
      accessPointId: previousAccessPoint.id,
      accessPointName: previousAccessPoint.name,
      shiftId: shift.id,
      type: 'shift_end',
      source,
      authorPersonId: context.personId,
      authorAccountId: context.accountId,
      summary: `Cambio de acceso: ${previousAccessPoint.name} → ${nextAccessPoint.name}`,
      details: {
        reason: 'reassigned',
        fromAccessPointId: previousAccessPoint.id,
        toAccessPointId: nextAccessPoint.id,
      },
    });

    await insertBitacoraEntry(tx, {
      communityId: context.communityId,
      accessPointId: nextAccessPoint.id,
      accessPointName: nextAccessPoint.name,
      shiftId: shift.id,
      type: 'shift_start',
      source,
      authorPersonId: context.personId,
      authorAccountId: context.accountId,
      summary: `Turno reasignado a ${nextAccessPoint.name}`,
      details: {
        reason: 'reassigned',
        fromAccessPointId: previousAccessPoint.id,
        toAccessPointId: nextAccessPoint.id,
      },
    });
  });

  return { ok: true, data: await currentResponse(context) };
}

export async function endShift(
  requester: GuardShiftRequester,
  shiftId: string,
  input: EndShiftDto,
): Promise<GuardShiftResult<GuardShiftCurrentResponse>> {
  const context = await resolveContext(requester);
  if (!context) return { ok: false, code: 'forbidden' };

  const [shift] = await db
    .select()
    .from(guardShifts)
    .where(and(eq(guardShifts.id, shiftId), eq(guardShifts.guardPersonId, context.personId)))
    .limit(1);
  if (!shift) return { ok: false, code: 'not_found' };
  if (shift.status === 'closed') {
    return { ok: true, data: await currentResponse(context) };
  }

  const segment = await openSegmentFor(shift.id);
  const accessPoint = segment ? await loadAccessPoint(segment.accessPointId) : null;
  const source = input.source ?? 'app';

  await db.transaction(async (tx) => {
    if (segment) {
      await tx
        .update(guardShiftSegments)
        .set({ endedAt: new Date(), endReason: 'shift_end' })
        .where(and(eq(guardShiftSegments.id, segment.id), isNull(guardShiftSegments.endedAt)));
    }

    await tx
      .update(guardShifts)
      .set({
        status: 'closed',
        endedAt: new Date(),
        endedByPersonId: context.personId,
        closedReason: 'manual',
        updatedAt: new Date(),
      })
      .where(eq(guardShifts.id, shift.id));

    if (accessPoint) {
      await insertBitacoraEntry(tx, {
        communityId: context.communityId,
        accessPointId: accessPoint.id,
        accessPointName: accessPoint.name,
        shiftId: shift.id,
        type: 'shift_end',
        source,
        authorPersonId: context.personId,
        authorAccountId: context.accountId,
        summary: `Turno finalizado en ${accessPoint.name}`,
        details: { reason: 'manual', accessPointId: accessPoint.id },
      });
    }
  });

  return { ok: true, data: await currentResponse(context) };
}

async function canManageCommunity(
  requester: GuardShiftRequester,
  communityId: string,
): Promise<boolean> {
  if (requester.isPlatformAdmin) return false;
  if (requester.role === 'org_admin') {
    const [community] = await db
      .select({ organizationId: communities.organizationId })
      .from(communities)
      .where(eq(communities.id, communityId))
      .limit(1);
    return Boolean(community && community.organizationId === requester.orgId);
  }
  return requester.role === 'community_admin' && requester.communityId === communityId;
}

export async function forceCloseShift(
  requester: GuardShiftRequester,
  shiftId: string,
  input: ForceCloseShiftDto,
): Promise<GuardShiftResult<GuardShiftCurrentResponse>> {
  const [shift] = await db.select().from(guardShifts).where(eq(guardShifts.id, shiftId)).limit(1);
  if (!shift) return { ok: false, code: 'not_found' };
  if (!(await canManageCommunity(requester, shift.communityId))) {
    return { ok: false, code: 'forbidden' };
  }
  if (shift.status === 'closed') return { ok: true, data: await currentResponseForShift(shift) };

  const segment = await openSegmentFor(shift.id);
  const accessPoint = segment ? await loadAccessPoint(segment.accessPointId) : null;
  const adminPersonId = requester.personId ?? null;

  await db.transaction(async (tx) => {
    if (segment) {
      await tx
        .update(guardShiftSegments)
        .set({ endedAt: new Date(), endReason: 'forced' })
        .where(and(eq(guardShiftSegments.id, segment.id), isNull(guardShiftSegments.endedAt)));
    }

    await tx
      .update(guardShifts)
      .set({
        status: 'closed',
        endedAt: new Date(),
        endedByPersonId: adminPersonId,
        closedReason: 'forced',
        updatedAt: new Date(),
      })
      .where(eq(guardShifts.id, shift.id));

    if (accessPoint) {
      await insertBitacoraEntry(tx, {
        communityId: shift.communityId,
        accessPointId: accessPoint.id,
        accessPointName: accessPoint.name,
        shiftId: shift.id,
        type: 'shift_end',
        source: 'dashboard',
        authorPersonId: adminPersonId,
        authorAccountId: requester.accountId ?? null,
        summary: `Turno cerrado por administración: ${input.reason}`,
        details: { reason: 'forced', note: input.reason, accessPointId: accessPoint.id },
      });
    }
  });

  const [updated] = await db
    .select()
    .from(guardShifts)
    .where(eq(guardShifts.id, shift.id))
    .limit(1);
  return { ok: true, data: await currentResponseForShift(updated) };
}

async function currentResponseForShift(
  shift: typeof guardShifts.$inferSelect,
): Promise<GuardShiftCurrentResponse> {
  const segments = await db
    .select({
      segment: guardShiftSegments,
      accessPoint: accessPoints,
    })
    .from(guardShiftSegments)
    .innerJoin(accessPoints, eq(guardShiftSegments.accessPointId, accessPoints.id))
    .where(eq(guardShiftSegments.shiftId, shift.id))
    .orderBy(desc(guardShiftSegments.startedAt));

  const latest = segments[0] ?? null;
  const elapsedSeconds = Math.max(
    0,
    Math.floor(((shift.endedAt ?? new Date()).getTime() - shift.startedAt.getTime()) / 1000),
  );
  return {
    shift: shiftDto(shift, latest?.accessPoint.name ?? null),
    segment: latest ? segmentDto(latest.segment, latest.accessPoint.name) : null,
    accessPoint: latest ? toAccessPoint(latest.accessPoint) : null,
    stale: shift.status === 'open' && elapsedSeconds > config.guardShifts.maxHours * 3600,
    elapsedSeconds,
  };
}

export async function listShifts(
  requester: GuardShiftRequester,
  query: { page: number; pageSize: number; communityId?: string; status?: 'open' | 'closed' },
): Promise<GuardShiftResult<GuardShiftListResponse>> {
  const conditions = [];
  if (requester.role === 'guard') {
    const context = await resolveContext(requester);
    if (!context) return { ok: false, code: 'forbidden' };
    conditions.push(eq(guardShifts.guardPersonId, context.personId));
  } else if (requester.role === 'community_admin') {
    if (!requester.communityId) return { ok: false, code: 'forbidden' };
    conditions.push(eq(guardShifts.communityId, requester.communityId));
  } else if (requester.role === 'org_admin') {
    const orgCommunities = await db
      .select({ id: communities.id })
      .from(communities)
      .where(eq(communities.organizationId, requester.orgId));
    const ids = orgCommunities.map((row) => row.id);
    if (ids.length === 0) {
      return {
        ok: true,
        data: { items: [], page: query.page, pageSize: query.pageSize, total: 0 },
      };
    }
    conditions.push(inArray(guardShifts.communityId, ids));
  } else if (requester.isPlatformAdmin) {
    if (!query.communityId) return { ok: false, code: 'forbidden' };
    conditions.push(eq(guardShifts.communityId, query.communityId));
  } else {
    return { ok: false, code: 'forbidden' };
  }

  if (query.communityId && !requester.isPlatformAdmin) {
    conditions.push(eq(guardShifts.communityId, query.communityId));
  }
  if (query.status) conditions.push(eq(guardShifts.status, query.status));

  const where = and(...conditions);

  const [totalRow] = await db.select({ value: count() }).from(guardShifts).where(where);
  const total = Number(totalRow?.value ?? 0);

  const rows = await db
    .select()
    .from(guardShifts)
    .where(where)
    .orderBy(desc(guardShifts.startedAt))
    .limit(query.pageSize)
    .offset((query.page - 1) * query.pageSize);

  const shiftIds = rows.map((row) => row.id);
  const segments =
    shiftIds.length > 0
      ? await db
          .select({
            segment: guardShiftSegments,
            accessPoint: accessPoints,
          })
          .from(guardShiftSegments)
          .innerJoin(accessPoints, eq(guardShiftSegments.accessPointId, accessPoints.id))
          .where(inArray(guardShiftSegments.shiftId, shiftIds))
          .orderBy(desc(guardShiftSegments.startedAt))
      : [];

  const byShift = new Map<string, typeof segments>();
  for (const row of segments) {
    const list = byShift.get(row.segment.shiftId) ?? [];
    list.push(row);
    byShift.set(row.segment.shiftId, list);
  }

  const items: GuardShiftHistoryItem[] = rows.map((row) => {
    const shiftSegments = byShift.get(row.id) ?? [];
    const latest = shiftSegments[0] ?? null;
    const durationSeconds = Math.max(
      0,
      Math.floor(((row.endedAt ?? new Date()).getTime() - row.startedAt.getTime()) / 1000),
    );
    return {
      ...shiftDto(row, latest?.accessPoint.name ?? null),
      durationSeconds,
      segments: shiftSegments.map((item) => segmentDto(item.segment, item.accessPoint.name)),
    };
  });

  return { ok: true, data: { items, page: query.page, pageSize: query.pageSize, total } };
}

export async function listActiveGuards(
  requester: GuardShiftRequester,
  communityId: string,
  accessPointId: string,
) {
  if (!(await canManageCommunity(requester, communityId))) {
    return { ok: false as const, code: 'forbidden' as const };
  }

  const rows = await db
    .select({
      shiftId: guardShifts.id,
      personId: guardShifts.guardPersonId,
      firstName: people.firstName,
      lastName: people.lastName,
      email: accounts.email,
      startedAt: guardShiftSegments.startedAt,
      accessPointId: accessPoints.id,
      accessPointName: accessPoints.name,
    })
    .from(guardShiftSegments)
    .innerJoin(guardShifts, eq(guardShiftSegments.shiftId, guardShifts.id))
    .innerJoin(accessPoints, eq(guardShiftSegments.accessPointId, accessPoints.id))
    .innerJoin(people, eq(guardShifts.guardPersonId, people.id))
    .leftJoin(accounts, eq(accounts.personId, people.id))
    .where(
      and(
        eq(guardShifts.communityId, communityId),
        eq(guardShifts.status, 'open'),
        isNull(guardShiftSegments.endedAt),
        eq(guardShiftSegments.accessPointId, accessPointId),
      ),
    )
    .orderBy(guardShiftSegments.startedAt);

  return {
    ok: true as const,
    data: {
      items: rows.map((row) => ({
        shiftId: row.shiftId,
        personId: row.personId,
        name: [row.firstName, row.lastName].filter(Boolean).join(' '),
        email: row.email,
        startedAt: row.startedAt.toISOString(),
        accessPointId: row.accessPointId,
        accessPointName: row.accessPointName,
      })),
    },
  };
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === '23505'
  );
}
