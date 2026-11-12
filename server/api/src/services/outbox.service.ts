import { and, desc, eq, inArray, lt, sql } from 'drizzle-orm';
import { createDb } from '@porteria/database';
import { outboxEvents } from '@porteria/database/schema';
import type { EventEnvelope, OutboxStats, OutboxTopicStats } from '@porteria/shared';

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
  topic: string;
}

/** The queue consumed by the main event worker. */
export const OUTBOX_TOPIC_EVENTS = 'events';

export async function enqueueEvent(
  executor: DbExecutor,
  envelope: EventEnvelope,
  topic: string = OUTBOX_TOPIC_EVENTS,
): Promise<boolean> {
  const [inserted] = await executor
    .insert(outboxEvents)
    .values({
      eventId: envelope.eventId,
      eventType: envelope.eventType,
      organizationId: envelope.organizationId,
      communityId: envelope.communityId ?? null,
      topic,
      payload: envelope.payload,
      envelope,
    })
    .onConflictDoNothing({ target: outboxEvents.eventId })
    .returning({ id: outboxEvents.id });

  return Boolean(inserted);
}

export async function claimBatch(
  batchSize: number,
  topic: string = OUTBOX_TOPIC_EVENTS,
): Promise<ClaimedOutboxRow[]> {
  const result = await db.execute<ClaimedOutboxRow>(sql`
    WITH claimed AS (
      SELECT id
      FROM outbox_events
      WHERE status = 'pending' AND available_at <= now() AND topic = ${topic}
      ORDER BY available_at ASC
      LIMIT ${batchSize}
      FOR UPDATE SKIP LOCKED
    )
    UPDATE outbox_events o
    SET status = 'processing', attempts = o.attempts + 1
    FROM claimed c
    WHERE o.id = c.id
    RETURNING o.id, o.envelope, o.attempts, o.organization_id, o.community_id, o.event_type, o.topic
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

export async function resetProcessing(topic: string = OUTBOX_TOPIC_EVENTS): Promise<number> {
  const updated = await db
    .update(outboxEvents)
    .set({ status: 'pending' })
    .where(and(eq(outboxEvents.status, 'processing'), eq(outboxEvents.topic, topic)))
    .returning({ id: outboxEvents.id });
  return updated.length;
}

function emptyTopicStats(): OutboxTopicStats {
  return { pending: 0, processing: 0, done: 0, dead: 0, oldestPendingAge: 0, lastError: null };
}

export async function getStats(): Promise<OutboxStats> {
  const topics: Record<string, OutboxTopicStats> = {};
  const forTopic = (topic: string): OutboxTopicStats => {
    topics[topic] ??= emptyTopicStats();
    return topics[topic];
  };

  const statusRows = await db.execute<{ topic: string; status: string; count: number }>(sql`
    SELECT topic, status, count(*)::int AS count
    FROM outbox_events
    GROUP BY topic, status
  `);
  for (const row of statusRows.rows) {
    const stats = forTopic(row.topic);
    switch (row.status) {
      case 'pending':
        stats.pending = Number(row.count);
        break;
      case 'processing':
        stats.processing = Number(row.count);
        break;
      case 'done':
        stats.done = Number(row.count);
        break;
      case 'dead':
        stats.dead = Number(row.count);
        break;
    }
  }

  const oldestRows = await db.execute<{ topic: string; oldestAt: Date | string }>(sql`
    SELECT topic, min(created_at) AS "oldestAt"
    FROM outbox_events
    WHERE status = 'pending'
    GROUP BY topic
  `);
  for (const row of oldestRows.rows) {
    const oldestAt = row.oldestAt instanceof Date ? row.oldestAt : new Date(row.oldestAt);
    forTopic(row.topic).oldestPendingAge = Math.max(
      0,
      Math.round((Date.now() - oldestAt.getTime()) / 1000),
    );
  }

  const errorRows = await db.execute<{ topic: string; lastError: string | null }>(sql`
    SELECT DISTINCT ON (topic) topic, last_error AS "lastError"
    FROM outbox_events
    WHERE status = 'dead'
    ORDER BY topic, created_at DESC
  `);
  for (const row of errorRows.rows) forTopic(row.topic).lastError = row.lastError;

  const totals = Object.values(topics).reduce(
    (acc, stats) => ({
      pending: acc.pending + stats.pending,
      processing: acc.processing + stats.processing,
      done: acc.done + stats.done,
      dead: acc.dead + stats.dead,
      oldestPendingAge: Math.max(acc.oldestPendingAge, stats.oldestPendingAge),
      lastError: acc.lastError ?? stats.lastError,
    }),
    emptyTopicStats(),
  );

  return { ...totals, topics };
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
