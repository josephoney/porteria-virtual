import { eq, and, gte, lte, count, desc } from 'drizzle-orm';
import { createDb } from '@porteria/database';
import { events, users } from '@porteria/database/schema';

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
  filters: { page: number; pageSize: number; eventType?: string; from?: string; to?: string },
): Promise<{ data: EventResult[]; total: number; page: number; pageSize: number }> {
  const offset = (filters.page - 1) * filters.pageSize;
  const conditions = [eq(events.organizationId, orgId)];

  if (filters.eventType) {
    conditions.push(eq(events.eventType, filters.eventType));
  }
  if (filters.from) {
    conditions.push(gte(events.createdAt, new Date(filters.from)));
  }
  if (filters.to) {
    conditions.push(lte(events.createdAt, new Date(filters.to)));
  }

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

export async function getEventStats(orgId: string): Promise<EventStats> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const rows = await db
    .select({
      eventType: events.eventType,
      count: count(),
    })
    .from(events)
    .where(and(eq(events.organizationId, orgId), gte(events.createdAt, today)))
    .groupBy(events.eventType);

  const byType: Record<string, number> = {};
  let total = 0;

  for (const row of rows) {
    byType[row.eventType] = row.count;
    total += row.count;
  }

  return { byType, total };
}

export async function getEventsTodayCount(orgId: string): Promise<number> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [result] = await db
    .select({ count: count() })
    .from(events)
    .where(and(eq(events.organizationId, orgId), gte(events.createdAt, today)));

  return result?.count ?? 0;
}

export async function insertEvent(event: {
  eventType: string;
  actorId?: string | null;
  actorRole?: string | null;
  organizationId: string;
  locationId?: string | null;
  accessPointId?: string | null;
  metadata?: Record<string, unknown> | null;
}): Promise<void> {
  await db.insert(events).values({
    eventType: event.eventType,
    actorId: event.actorId ?? null,
    actorRole: event.actorRole ?? null,
    organizationId: event.organizationId,
    locationId: event.locationId ?? null,
    accessPointId: event.accessPointId ?? null,
    metadata: event.metadata ?? undefined,
  });
}
