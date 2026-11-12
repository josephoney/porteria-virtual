import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { eq, inArray } from 'drizzle-orm';

process.env.OUTBOX_WORKER_ENABLED = 'false';

import { createDb } from '@porteria/database';
import { organizations, outboxEvents } from '@porteria/database/schema';
import type { EventEnvelope } from '@porteria/shared';
import {
  claimBatch,
  enqueueEvent,
  getStats,
  OUTBOX_TOPIC_EVENTS,
} from '../src/services/outbox.service.js';

const db = createDb();

/**
 * The topic column is varchar(20) and every run needs its own namespace so the
 * test never claims rows from the real event queue.
 */
const runId = randomUUID().slice(0, 8);
const topicPersist = `qa-p-${runId}`;
const topicClaim = `qa-c-${runId}`;
const topicOther = `qa-o-${runId}`;
const topicStats = `qa-s-${runId}`;

const eventIds: string[] = [];
let organizationId: string;

function buildEnvelope(eventType: string): EventEnvelope {
  const eventId = randomUUID();
  eventIds.push(eventId);
  return {
    eventId,
    eventType,
    version: 1,
    occurredAt: new Date().toISOString(),
    organizationId,
    payload: {},
  };
}

before(async () => {
  const [organization] = await db.select({ id: organizations.id }).from(organizations).limit(1);
  assert.ok(organization, 'The test database needs at least one organization');
  organizationId = organization.id;
});

after(async () => {
  if (eventIds.length === 0) return;
  await db.delete(outboxEvents).where(inArray(outboxEvents.eventId, eventIds));
});

describe('outbox topics', () => {
  it('persists the topic passed to enqueueEvent', async () => {
    const envelope = buildEnvelope('qa.topic.persisted');

    const inserted = await enqueueEvent(db, envelope, topicPersist);
    assert.equal(inserted, true);

    const [row] = await db
      .select({ topic: outboxEvents.topic })
      .from(outboxEvents)
      .where(eq(outboxEvents.eventId, envelope.eventId));

    assert.equal(row?.topic, topicPersist);
  });

  it('defaults to the events topic', () => {
    assert.equal(OUTBOX_TOPIC_EVENTS, 'events');
  });

  it('claims only rows from the requested topic', async () => {
    const target = buildEnvelope('qa.topic.target');
    const other = buildEnvelope('qa.topic.other');
    await enqueueEvent(db, target, topicClaim);
    await enqueueEvent(db, other, topicOther);

    const availableAt = new Date(Date.now() - 60_000);
    await db
      .update(outboxEvents)
      .set({ availableAt })
      .where(inArray(outboxEvents.eventId, [target.eventId, other.eventId]));

    const claimed = await claimBatch(50, topicClaim);

    assert.ok(claimed.some((row) => row.envelope.eventId === target.eventId));
    assert.ok(claimed.every((row) => row.topic === topicClaim));

    const [otherRow] = await db
      .select({ status: outboxEvents.status })
      .from(outboxEvents)
      .where(eq(outboxEvents.eventId, other.eventId));

    assert.equal(otherRow?.status, 'pending');
  });

  it('reports stats per topic while keeping the totals', async () => {
    await enqueueEvent(db, buildEnvelope('qa.topic.stats'), topicStats);

    const stats = await getStats();
    const entry = stats.topics[topicStats];

    assert.ok(entry, 'Expected a stats entry for the test topic');
    assert.equal(entry.pending, 1);

    const summedPending = Object.values(stats.topics).reduce(
      (sum, topicStats) => sum + topicStats.pending,
      0,
    );
    assert.equal(stats.pending, summedPending);
  });
});
