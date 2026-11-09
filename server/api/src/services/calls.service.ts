import { eq, and, gte, lte, count, desc } from 'drizzle-orm';
import type { CallStatus } from '@porteria/shared';
import { createDb } from '@porteria/database';
import { calls, kiosks, users, people, accessPoints, communities } from '@porteria/database/schema';
import { createEventEnvelope } from '@porteria/shared';
import { enqueueEvent } from './outbox.service.js';

const db = createDb();

export interface CallResult {
  id: string;
  status: string;
  startedAt: Date | null;
  endedAt: Date | null;
  duration: number | null;
  communityId: string;
  communityName: string | null;
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
    communityId: row.communityId as string,
    communityName: (row.communityName as string) ?? null,
    kioskName: (row.kioskName as string) ?? null,
    operatorName: (row.operatorName as string) ?? null,
    accessPointName: (row.accessPointName as string) ?? null,
  };
}

export async function listCalls(
  orgId: string,
  filters: {
    page: number;
    pageSize: number;
    status?: string;
    from?: string;
    to?: string;
    operatorId?: string;
    communityId?: string;
  },
): Promise<{ data: CallResult[]; total: number; page: number; pageSize: number }> {
  const offset = (filters.page - 1) * filters.pageSize;
  const conditions = [eq(calls.organizationId, orgId)];

  if (filters.status) conditions.push(eq(calls.status, filters.status as CallStatus));
  if (filters.from) conditions.push(gte(calls.startedAt, new Date(filters.from)));
  if (filters.to) conditions.push(lte(calls.startedAt, new Date(filters.to)));
  if (filters.operatorId) conditions.push(eq(calls.operatorId, filters.operatorId));
  if (filters.communityId) conditions.push(eq(calls.communityId, filters.communityId));

  const data = await db
    .select({
      id: calls.id,
      status: calls.status,
      startedAt: calls.startedAt,
      endedAt: calls.endedAt,
      duration: calls.duration,
      communityId: calls.communityId,
      communityName: communities.name,
      kioskName: kiosks.name,
      operatorName: users.name,
      accessPointName: accessPoints.name,
    })
    .from(calls)
    .innerJoin(communities, eq(calls.communityId, communities.id))
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
      communityId: calls.communityId,
      communityName: communities.name,
      kioskName: kiosks.name,
      operatorName: users.name,
      accessPointName: accessPoints.name,
    })
    .from(calls)
    .innerJoin(communities, eq(calls.communityId, communities.id))
    .leftJoin(kiosks, eq(calls.kioskId, kiosks.id))
    .leftJoin(users, eq(calls.operatorId, users.id))
    .leftJoin(accessPoints, eq(calls.accessPointId, accessPoints.id))
    .where(and(eq(calls.id, id), eq(calls.organizationId, orgId)))
    .limit(1);

  if (rows.length === 0) return null;
  return toCallResult(rows[0]);
}

export async function getCallsTodayCount(
  orgId: string,
  from?: string,
  to?: string,
  communityId?: string,
): Promise<number> {
  const startDate = from ? new Date(from) : new Date(new Date().setHours(0, 0, 0, 0));
  const conditions = [eq(calls.organizationId, orgId), gte(calls.startedAt, startDate)];
  if (to) conditions.push(lte(calls.startedAt, new Date(to)));
  if (communityId) conditions.push(eq(calls.communityId, communityId));

  const [result] = await db
    .select({ count: count() })
    .from(calls)
    .where(and(...conditions));

  return result?.count ?? 0;
}

export async function getActiveCallsCount(orgId: string, communityId?: string): Promise<number> {
  const conditions = [eq(calls.organizationId, orgId), eq(calls.status, 'active')];
  if (communityId) conditions.push(eq(calls.communityId, communityId));

  const [result] = await db
    .select({ count: count() })
    .from(calls)
    .where(and(...conditions));

  return result?.count ?? 0;
}

export async function createCall(input: {
  callId: string;
  kioskId: string;
  visitor?: { name?: string; known?: boolean } | null;
}): Promise<{ success: boolean; error?: string }> {
  const [kiosk] = await db
    .select({
      id: kiosks.id,
      accessPointId: kiosks.accessPointId,
      communityId: kiosks.communityId,
    })
    .from(kiosks)
    .where(eq(kiosks.id, input.kioskId))
    .limit(1);

  if (!kiosk) return { success: false, error: 'Kiosk not found' };

  const [community] = await db
    .select({ organizationId: communities.organizationId })
    .from(communities)
    .where(eq(communities.id, kiosk.communityId))
    .limit(1);

  if (!community) {
    return { success: false, error: 'Kiosk not linked to an organization' };
  }

  await db.transaction(async (tx) => {
    await tx.insert(calls).values({
      id: input.callId,
      kioskId: kiosk.id,
      organizationId: community.organizationId,
      communityId: kiosk.communityId,
      accessPointId: kiosk.accessPointId,
      status: 'pending',
    });

    await enqueueEvent(
      tx,
      createEventEnvelope({
        eventType: 'call.started',
        actorRole: 'kiosk',
        organizationId: community.organizationId,
        communityId: kiosk.communityId,
        accessPointId: kiosk.accessPointId ?? null,
        payload: input.visitor ? { visitor: input.visitor } : {},
      }),
    );
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
  if (input.operatorId !== undefined) {
    updates.operatorId = input.operatorId;
    if (input.operatorId) {
      const [operator] = await db
        .select({ personId: people.id })
        .from(users)
        .innerJoin(people, eq(people.contactEmail, users.email))
        .where(eq(users.id, input.operatorId))
        .limit(1);
      updates.operatorPersonId = operator?.personId ?? null;
    } else {
      updates.operatorPersonId = null;
    }
  }
  if (input.endedAt) updates.endedAt = new Date(input.endedAt);
  if (input.duration !== undefined) updates.duration = input.duration;

  if (Object.keys(updates).length === 0) {
    return { success: false, error: 'No fields to update' };
  }

  try {
    await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(calls)
        .set(updates)
        .where(eq(calls.id, callId))
        .returning();

      if (!updated) throw new Error('CALL_NOT_FOUND');

      if (input.eventType) {
        await enqueueEvent(
          tx,
          createEventEnvelope({
            eventType: input.eventType,
            actorRole: input.operatorId ? 'operator' : 'kiosk',
            organizationId: updated.organizationId,
            communityId: updated.communityId,
            accessPointId: updated.accessPointId ?? null,
            payload: input.duration !== undefined ? { duration: input.duration } : {},
          }),
        );
      }
    });

    return { success: true };
  } catch (err) {
    if ((err as Error).message === 'CALL_NOT_FOUND') {
      return { success: false, error: 'Call not found' };
    }
    throw err;
  }
}
