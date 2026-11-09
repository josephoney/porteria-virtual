import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { EventEnvelope } from '@porteria/shared';
import config from '../config.js';
import * as outboxService from '../services/outbox.service.js';
import * as eventsService from '../services/events.service.js';

export async function internalOutboxRoutes(app: FastifyInstance) {
  app.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    const key = request.headers['x-internal-key'];
    if (key !== config.internalApiKey) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }
  });

  app.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Partial<EventEnvelope>;
    if (!body.eventId || !body.eventType) {
      return reply.status(400).send({
        error: 'Validation failed',
        details: 'eventId and eventType are required',
      });
    }

    let organizationId = body.organizationId;
    if (!organizationId && body.communityId) {
      organizationId = await eventsService.resolveOrgIdFromCommunityId(body.communityId);
    }

    if (!organizationId) {
      return reply.status(400).send({
        error: 'Validation failed',
        details: 'organizationId or communityId is required',
      });
    }

    const envelope: EventEnvelope = {
      eventId: body.eventId,
      eventType: body.eventType,
      version: body.version ?? 1,
      occurredAt: body.occurredAt ?? new Date().toISOString(),
      organizationId,
      communityId: body.communityId ?? null,
      actor: body.actor ?? null,
      actorRole: body.actorRole ?? null,
      accessPointId: body.accessPointId ?? null,
      payload: body.payload ?? {},
    };

    const inserted = await outboxService.enqueueEventDefault(envelope);
    return reply.status(inserted ? 201 : 200).send({ ok: true, duplicate: !inserted });
  });

  app.get('/stats', async () => outboxService.getStats());

  app.get('/dead', async (request: FastifyRequest) => {
    const query = request.query as { limit?: string };
    const limit = query.limit ? parseInt(query.limit, 10) : 100;
    return outboxService.listDead(limit);
  });

  app.post('/:id/replay', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as { actorId?: string };
    const replayed = await outboxService.replayEvent(id);
    if (!replayed) {
      return reply.status(404).send({ error: 'Dead event not found' });
    }

    eventsService
      .insertEvent({
        eventType: 'outbox.replayed',
        actorId: body.actorId ?? null,
        actorRole: 'admin',
        organizationId: replayed.organizationId,
        communityId: replayed.communityId,
        metadata: { outboxId: replayed.id, eventId: replayed.eventId },
      })
      .catch(() => {});

    return { ok: true, eventId: replayed.eventId };
  });

  app.post('/replay-bulk', async (request: FastifyRequest) => {
    const body = (request.body ?? {}) as {
      ids?: string[];
      limit?: number;
      actorId?: string;
    };
    const replayed = await outboxService.replayBulk(body.ids, body.limit);

    for (const row of replayed) {
      eventsService
        .insertEvent({
          eventType: 'outbox.replayed',
          actorId: body.actorId ?? null,
          actorRole: 'admin',
          organizationId: row.organizationId,
          communityId: row.communityId,
          metadata: { outboxId: row.id, eventId: row.eventId },
        })
        .catch(() => {});
    }

    return { ok: true, replayed: replayed.length };
  });

  app.post('/purge', async () => {
    const purged = await outboxService.purgeDone(config.outbox.retentionDays);
    return { ok: true, purged };
  });
}
