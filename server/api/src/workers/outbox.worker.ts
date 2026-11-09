import type { FastifyBaseLogger } from 'fastify';
import config from '../config.js';
import { ingestEnvelope } from '../services/events.service.js';
import {
  claimBatch,
  getStats,
  markDone,
  markFailed,
  purgeDone,
  resetProcessing,
} from '../services/outbox.service.js';

let timer: NodeJS.Timeout | null = null;
let running = false;
let stopped = false;
let ticks = 0;

async function tick(logger: FastifyBaseLogger): Promise<void> {
  if (running || stopped) return;
  running = true;

  try {
    const rows = await claimBatch(config.outbox.batchSize);

    for (const row of rows) {
      try {
        const result = await ingestEnvelope(row.envelope);
        await markDone(row.id);
        logger.info(
          {
            eventId: row.envelope.eventId,
            eventType: row.envelope.eventType,
            attempts: row.attempts,
            duplicate: result.duplicate,
          },
          'Outbox event delivered',
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await markFailed(row.id, message, row.attempts, config.outbox.maxAttempts);
        logger.warn(
          {
            eventId: row.envelope.eventId,
            eventType: row.envelope.eventType,
            attempts: row.attempts,
            error: message,
          },
          'Outbox delivery failed',
        );
      }
    }

    ticks += 1;
    if (ticks % 60 === 0) {
      const purged = await purgeDone(config.outbox.retentionDays);
      if (purged > 0) {
        logger.info({ purged }, 'Outbox processed events purged');
      }
    }

    const stats = await getStats();
    if (stats.oldestPendingAge > config.outbox.lagWarnSeconds) {
      logger.warn(
        { oldestPendingAge: stats.oldestPendingAge, pending: stats.pending },
        'Outbox lag exceeds threshold',
      );
    }
  } catch (err) {
    logger.error(
      { error: err instanceof Error ? err.message : String(err) },
      'Outbox worker tick failed',
    );
  } finally {
    running = false;
    if (!stopped) {
      timer = setTimeout(() => void tick(logger), config.outbox.pollIntervalMs);
    }
  }
}

export async function startOutboxWorker(logger: FastifyBaseLogger): Promise<void> {
  if (!config.outbox.workerEnabled) {
    logger.info('Outbox worker disabled');
    return;
  }

  stopped = false;
  const recovered = await resetProcessing();
  if (recovered > 0) {
    logger.warn({ recovered }, 'Outbox recovered stale processing rows');
  }

  logger.info(
    {
      batchSize: config.outbox.batchSize,
      pollIntervalMs: config.outbox.pollIntervalMs,
      maxAttempts: config.outbox.maxAttempts,
    },
    'Outbox worker started',
  );

  void tick(logger);
}

export function stopOutboxWorker(): void {
  stopped = true;
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
}
