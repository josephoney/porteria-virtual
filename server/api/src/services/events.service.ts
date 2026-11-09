import { eq, and, gte, lte, count, desc } from 'drizzle-orm';
import { createDb } from '@porteria/database';
import type { EventEnvelope } from '@porteria/shared';
import type { DbExecutor } from './outbox.service.js';
import { events, users, communities, ingestedEvents } from '@porteria/database/schema';

const db = createDb();

export interface EventResult {
  id: string;
  eventType: string;
  actorId: string | null;
  actorRole: string | null;
  actorName: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

function toEventResult(row: Record<string, unknown>): EventResult {
  return {
    id: row.id as string,
    eventType: row.eventType as string,
    actorId: row.actorId as string | null,
    actorRole: row.actorRole as string | null,
    actorName: (row.actorName as string) ?? null,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    createdAt: row.createdAt as Date,
  };
}

export async function listEvents(
  orgId: string,
  filters: {
    page: number;
    pageSize: number;
    eventType?: string;
    from?: string;
    to?: string;
    actorId?: string;
    accessPointId?: string;
    communityId?: string;
  },
): Promise<{ data: EventResult[]; total: number; page: number; pageSize: number }> {
  const offset = (filters.page - 1) * filters.pageSize;
  const conditions = [eq(events.organizationId, orgId)];

  if (filters.eventType) conditions.push(eq(events.eventType, filters.eventType));
  if (filters.from) conditions.push(gte(events.createdAt, new Date(filters.from)));
  if (filters.to) conditions.push(lte(events.createdAt, new Date(filters.to)));
  if (filters.actorId) conditions.push(eq(events.actorId, filters.actorId));
  if (filters.accessPointId) conditions.push(eq(events.accessPointId, filters.accessPointId));
  if (filters.communityId) conditions.push(eq(events.communityId, filters.communityId));

  const data = await db
    .select({
      id: events.id,
      eventType: events.eventType,
      actorId: events.actorId,
      actorRole: events.actorRole,
      actorName: users.name,
      metadata: events.metadata,
      createdAt: events.createdAt,
    })
    .from(events)
    .leftJoin(users, eq(events.actorId, users.id))
    .where(and(...conditions))
    .orderBy(desc(events.createdAt))
    .limit(filters.pageSize)
    .offset(offset);

  const [result] = await db
    .select({ count: count() })
    .from(events)
    .where(and(...conditions));

  return {
    data: data.map(toEventResult),
    total: result?.count ?? 0,
    page: filters.page,
    pageSize: filters.pageSize,
  };
}

export interface EventStats {
  byType: Record<string, number>;
  total: number;
}

export async function getEventStats(
  orgId: string,
  from?: string,
  to?: string,
  communityId?: string,
): Promise<EventStats> {
  const startDate = from ? new Date(from) : new Date(new Date().setHours(0, 0, 0, 0));
  const conditions = [eq(events.organizationId, orgId), gte(events.createdAt, startDate)];
  if (to) conditions.push(lte(events.createdAt, new Date(to)));
  if (communityId) conditions.push(eq(events.communityId, communityId));

  const rows = await db
    .select({ eventType: events.eventType, count: count() })
    .from(events)
    .where(and(...conditions))
    .groupBy(events.eventType);

  const byType: Record<string, number> = {};
  let total = 0;

  for (const row of rows) {
    byType[row.eventType] = row.count;
    total += row.count;
  }

  return { byType, total };
}

export async function getEventsTodayCount(
  orgId: string,
  from?: string,
  to?: string,
  communityId?: string,
): Promise<number> {
  const startDate = from ? new Date(from) : new Date(new Date().setHours(0, 0, 0, 0));
  const conditions = [eq(events.organizationId, orgId), gte(events.createdAt, startDate)];
  if (to) conditions.push(lte(events.createdAt, new Date(to)));
  if (communityId) conditions.push(eq(events.communityId, communityId));

  const [result] = await db
    .select({ count: count() })
    .from(events)
    .where(and(...conditions));

  return result?.count ?? 0;
}

export async function resolveOrgIdFromCommunityId(communityId: string): Promise<string> {
  const [row] = await db
    .select({ orgId: communities.organizationId })
    .from(communities)
    .where(eq(communities.id, communityId))
    .limit(1);

  if (!row) {
    throw new Error(`No organization found for community ${communityId}`);
  }

  return row.orgId;
}

export async function insertEvent(event: {
  eventType: string;
  actorId?: string | null;
  actorPersonId?: string | null;
  actorRole?: string | null;
  organizationId: string;
  communityId?: string | null;
  accessPointId?: string | null;
  metadata?: Record<string, unknown> | null;
}, executor: DbExecutor = db): Promise<void> {
  await executor.insert(events).values({
    eventType: event.eventType,
    actorId: event.actorId ?? null,
    actorPersonId: event.actorPersonId ?? null,
    actorRole: event.actorRole ?? null,
    organizationId: event.organizationId,
    communityId: event.communityId ?? null,
    accessPointId: event.accessPointId ?? null,
    metadata: event.metadata ?? undefined,
  });
}
export async function ingestEnvelope(
  envelope: EventEnvelope,
): Promise<{ duplicate: boolean }> {
  return db.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(ingestedEvents)
      .values({ eventId: envelope.eventId })
      .onConflictDoNothing()
      .returning({ eventId: ingestedEvents.eventId });

    if (!inserted) return { duplicate: true };

    await tx.insert(events).values({
      eventType: envelope.eventType,
      actorId: envelope.actor?.id ?? null,
      actorRole: envelope.actor?.role ?? envelope.actorRole ?? null,
      organizationId: envelope.organizationId,
      communityId: envelope.communityId ?? null,
      accessPointId: envelope.accessPointId ?? null,
      metadata: {
        ...envelope.payload,
        eventId: envelope.eventId,
        occurredAt: envelope.occurredAt,
      },
    });

    return { duplicate: false };
  });
}