import { eq, and, gte, lte, count, desc } from 'drizzle-orm';
import { createDb } from '@porteria/database';
import { calls, kiosks, users, accessPoints, locations } from '@porteria/database/schema';
import { insertEvent } from './events.service.js';

const db = createDb();

export interface CallResult {
  id: string;
  status: string;
  startedAt: Date | null;
  endedAt: Date | null;
  duration: number | null;
  kioskName: string | null;
  operatorName: string | null;
  accessPointName: string | null;
}

function toCallResult(row: Record<string, unknown>): CallResult {
  return {
    id: row.id as string,
    status: row.status as string,
    startedAt: row.startedAt as Date | null,
    endedAt: row.endedAt as Date | null,
    duration: row.duration as number | null,
    kioskName: (row.kioskName as string) ?? null,
    operatorName: (row.operatorName as string) ?? null,
    accessPointName: (row.accessPointName as string) ?? null,
  };
}

export async function listCalls(
  orgId: string,
  filters: { page: number; pageSize: number; status?: string; from?: string; to?: string; operatorId?: string },
): Promise<{ data: CallResult[]; total: number; page: number; pageSize: number }> {
  const offset = (filters.page - 1) * filters.pageSize;
  const conditions = [eq(calls.organizationId, orgId)];

  if (filters.status) {
    conditions.push(eq(calls.status, filters.status as any));
  }
  if (filters.from) {
    conditions.push(gte(calls.startedAt, new Date(filters.from)));
  }
  if (filters.to) {
    conditions.push(lte(calls.startedAt, new Date(filters.to)));
  }
  if (filters.operatorId) {
    conditions.push(eq(calls.operatorId, filters.operatorId));
  }

  const data = await db
    .select({
      id: calls.id,
      status: calls.status,
      startedAt: calls.startedAt,
      endedAt: calls.endedAt,
      duration: calls.duration,
      kioskName: kiosks.name,
      operatorName: users.name,
      accessPointName: accessPoints.name,
    })
    .from(calls)
    .leftJoin(kiosks, eq(calls.kioskId, kiosks.id))
    .leftJoin(users, eq(calls.operatorId, users.id))
    .leftJoin(accessPoints, eq(calls.accessPointId, accessPoints.id))
    .where(and(...conditions))
    .orderBy(desc(calls.startedAt))
    .limit(filters.pageSize)
    .offset(offset);

  const [result] = await db
    .select({ count: count() })
    .from(calls)
    .where(and(...conditions));

  return {
    data: data.map(toCallResult),
    total: result?.count ?? 0,
    page: filters.page,
    pageSize: filters.pageSize,
  };
}

export async function getCallById(id: string, orgId: string): Promise<CallResult | null> {
  const rows = await db
    .select({
      id: calls.id,
      status: calls.status,
      startedAt: calls.startedAt,
      endedAt: calls.endedAt,
      duration: calls.duration,
      kioskName: kiosks.name,
      operatorName: users.name,
      accessPointName: accessPoints.name,
    })
    .from(calls)
    .leftJoin(kiosks, eq(calls.kioskId, kiosks.id))
    .leftJoin(users, eq(calls.operatorId, users.id))
    .leftJoin(accessPoints, eq(calls.accessPointId, accessPoints.id))
    .where(and(eq(calls.id, id), eq(calls.organizationId, orgId)))
    .limit(1);

  if (rows.length === 0) return null;
  return toCallResult(rows[0]);
}

export async function getCallsTodayCount(orgId: string): Promise<number> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [result] = await db
    .select({ count: count() })
    .from(calls)
    .where(and(eq(calls.organizationId, orgId), gte(calls.startedAt, today)));

  return result?.count ?? 0;
}

export async function getActiveCallsCount(orgId: string): Promise<number> {
  const [result] = await db
    .select({ count: count() })
    .from(calls)
    .where(
      and(
        eq(calls.organizationId, orgId),
        eq(calls.status, 'active' as any),
      ),
    );

  return result?.count ?? 0;
}

export async function createCall(input: {
  callId: string;
  buildingId: string;
  visitor?: { name?: string; known?: boolean } | null;
}): Promise<{ success: boolean; error?: string }> {
  const [kiosk] = await db
    .select({ id: kiosks.id, accessPointId: kiosks.accessPointId })
    .from(kiosks)
    .where(eq(kiosks.rpiId, input.buildingId))
    .limit(1);

  if (!kiosk) return { success: false, error: 'Kiosk not found' };

  let organizationId: string | null = null;
  if (kiosk.accessPointId) {
    const [ap] = await db
      .select({ locationId: accessPoints.locationId })
      .from(accessPoints)
      .where(eq(accessPoints.id, kiosk.accessPointId))
      .limit(1);

    if (ap) {
      const [loc] = await db
        .select({ organizationId: locations.organizationId })
        .from(locations)
        .where(eq(locations.id, ap.locationId))
        .limit(1);

      if (loc) organizationId = loc.organizationId;
    }
  }

  if (!organizationId) {
    return { success: false, error: 'Kiosk not linked to an organization' };
  }

  await db.insert(calls).values({
    id: input.callId,
    kioskId: kiosk.id,
    organizationId,
    accessPointId: kiosk.accessPointId,
    status: 'pending',
  });

  await insertEvent({
    eventType: 'call.started',
    actorRole: 'kiosk',
    organizationId,
    accessPointId: kiosk.accessPointId ?? null,
    metadata: input.visitor ? { visitor: input.visitor } : null,
  });

  return { success: true };
}

export async function updateCall(
  callId: string,
  input: {
    status?: string;
    operatorId?: string | null;
    endedAt?: string;
    duration?: number;
    eventType?: string;
  },
): Promise<{ success: boolean; error?: string }> {
  const updates: Record<string, unknown> = {};

  if (input.status) updates.status = input.status;
  if (input.operatorId !== undefined) updates.operatorId = input.operatorId;
  if (input.endedAt) updates.endedAt = new Date(input.endedAt);
  if (input.duration !== undefined) updates.duration = input.duration;

  if (Object.keys(updates).length === 0) {
    return { success: false, error: 'No fields to update' };
  }

  await db.update(calls).set(updates).where(eq(calls.id, callId));

  if (input.eventType) {
    const [call] = await db
      .select({
        organizationId: calls.organizationId,
        accessPointId: calls.accessPointId,
      })
      .from(calls)
      .where(eq(calls.id, callId))
      .limit(1);

    if (call) {
      await insertEvent({
        eventType: input.eventType,
        actorRole: input.operatorId ? 'operator' : 'kiosk',
        organizationId: call.organizationId,
        accessPointId: call.accessPointId ?? null,
        metadata: input.duration !== undefined ? { duration: input.duration } : null,
      });
    }
  }

  return { success: true };
}
