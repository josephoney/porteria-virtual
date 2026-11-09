import { and, count, desc, eq, inArray, lt, sql } from 'drizzle-orm';
import { createDb } from '@porteria/database';
import { outboxEvents } from '@porteria/database/schema';
import type { EventEnvelope, OutboxStats } from '@porteria/shared';

const db = createDb();

type DbClient = typeof db;
type Transaction = Parameters<Parameters<DbClient['transaction']>[0]>[0];
export type DbExecutor = DbClient | Transaction;

export interface ClaimedOutboxRow {
  [key: string]: unknown;
  id: string;
  envelope: EventEnvelope;
  attempts: number;
  organization_id: string;
  community_id: string | null;
  event_type: string;
}

export async function enqueueEvent(
  executor: DbExecutor,
  envelope: EventEnvelope,
): Promise<boolean> {
  const [inserted] = await executor
    .insert(outboxEvents)
    .values({
      eventId: envelope.eventId,
      eventType: envelope.eventType,
      organizationId: envelope.organizationId,
      communityId: envelope.communityId ?? null,
      payload: envelope.payload,
      envelope,
    })
    .onConflictDoNothing({ target: outboxEvents.eventId })
    .returning({ id: outboxEvents.id });

  return Boolean(inserted);
}

export async function claimBatch(batchSize: number): Promise<ClaimedOutboxRow[]> {
  const result = await db.execute<ClaimedOutboxRow>(sql`
    WITH claimed AS (
      SELECT id
      FROM outbox_events
      WHERE status = 'pending' AND available_at <= now()
      ORDER BY available_at ASC
      LIMIT ${batchSize}
      FOR UPDATE SKIP LOCKED
    )
    UPDATE outbox_events o
    SET status = 'processing', attempts = o.attempts + 1
    FROM claimed c
    WHERE o.id = c.id
    RETURNING o.id, o.envelope, o.attempts, o.organization_id, o.community_id, o.event_type
  `);

  return result.rows;
}

export async function markDone(id: string): Promise<void> {
  await db
    .update(outboxEvents)
    .set({ status: 'done', processedAt: new Date(), lastError: null })
    .where(eq(outboxEvents.id, id));
}

export async function markFailed(
  id: string,
  error: string,
  attempts: number,
  maxAttempts: number,
): Promise<void> {
  if (attempts >= maxAttempts) {
    await db
      .update(outboxEvents)
      .set({ status: 'dead', lastError: error.slice(0, 2000) })
      .where(eq(outboxEvents.id, id));
    return;
  }

  const backoffMs = Math.min(1000 * 2 ** attempts, 60_000);
  const jitter = Math.floor(Math.random() * 500);
  await db
    .update(outboxEvents)
    .set({
      status: 'pending',
      availableAt: new Date(Date.now() + backoffMs + jitter),
      lastError: error.slice(0, 2000),
    })
    .where(eq(outboxEvents.id, id));
}

export async function resetProcessing(): Promise<number> {
  const updated = await db
    .update(outboxEvents)
    .set({ status: 'pending' })
    .where(eq(outboxEvents.status, 'processing'))
    .returning({ id: outboxEvents.id });
  return updated.length;
}

export async function getStats(): Promise<OutboxStats> {
  const rows = await db
    .select({ status: outboxEvents.status, count: count() })
    .from(outboxEvents)
    .groupBy(outboxEvents.status);

  const byStatus: Record<string, number> = {};
  for (const row of rows) byStatus[row.status] = row.count;

  const [oldest] = await db
    .select({ createdAt: outboxEvents.createdAt })
    .from(outboxEvents)
    .where(eq(outboxEvents.status, 'pending'))
    .orderBy(outboxEvents.createdAt)
    .limit(1);

  const [lastError] = await db
    .select({ lastError: outboxEvents.lastError })
    .from(outboxEvents)
    .where(eq(outboxEvents.status, 'dead'))
    .orderBy(desc(outboxEvents.createdAt))
    .limit(1);

  return {
    pending: byStatus.pending ?? 0,
    processing: byStatus.processing ?? 0,
    done: byStatus.done ?? 0,
    dead: byStatus.dead ?? 0,
    oldestPendingAge: oldest
      ? Math.max(0, Math.round((Date.now() - oldest.createdAt.getTime()) / 1000))
      : 0,
    lastError: lastError?.lastError ?? null,
  };
}

export async function listDead(limit = 100) {
  return db
    .select()
    .from(outboxEvents)
    .where(eq(outboxEvents.status, 'dead'))
    .orderBy(desc(outboxEvents.createdAt))
    .limit(Math.min(Math.max(limit, 1), 200));
}

export async function replayEvent(id: string) {
  const [updated] = await db
    .update(outboxEvents)
    .set({ status: 'pending', attempts: 0, availableAt: new Date(), lastError: null })
    .where(and(eq(outboxEvents.id, id), eq(outboxEvents.status, 'dead')))
    .returning();
  return updated ?? null;
}

export interface ReplayedOutboxRow {
  [key: string]: unknown;
  id: string;
  eventId: string;
  organizationId: string;
  communityId: string | null;
}

export async function replayBulk(
  ids: string[] | undefined,
  limit = 100,
): Promise<ReplayedOutboxRow[]> {
  const max = Math.min(Math.max(limit, 1), 100);

  if (ids && ids.length > 0) {
    return db
      .update(outboxEvents)
      .set({ status: 'pending', attempts: 0, availableAt: new Date(), lastError: null })
      .where(and(eq(outboxEvents.status, 'dead'), inArray(outboxEvents.id, ids.slice(0, max))))
      .returning({
        id: outboxEvents.id,
        eventId: outboxEvents.eventId,
        organizationId: outboxEvents.organizationId,
        communityId: outboxEvents.communityId,
      });
  }

  const result = await db.execute<ReplayedOutboxRow>(sql`
    UPDATE outbox_events
    SET status = 'pending', attempts = 0, available_at = now(), last_error = null
    WHERE id IN (
      SELECT id FROM outbox_events
      WHERE status = 'dead'
      ORDER BY created_at ASC
      LIMIT ${max}
    )
    RETURNING id, event_id AS "eventId", organization_id AS "organizationId", community_id AS "communityId"
  `);
  return result.rows;
}

export async function purgeDone(retentionDays: number): Promise<number> {
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
  const deleted = await db
    .delete(outboxEvents)
    .where(and(eq(outboxEvents.status, 'done'), lt(outboxEvents.processedAt, cutoff)))
    .returning({ id: outboxEvents.id });
  return deleted.length;
}
export async function enqueueEventDefault(envelope: EventEnvelope): Promise<boolean> {
  return enqueueEvent(db, envelope);
}