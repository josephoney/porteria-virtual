import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { requirePlatformAdmin } from '../middlewares/rbac.js';
import * as eventsService from '../services/events.service.js';
import { eventsQuerySchema } from '../schemas/index.js';
import config from '../config.js';
import type { EventEnvelope } from '@porteria/shared';

export async function eventsRoutes(app: FastifyInstance) {
  app.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
    } catch (err) {
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message:
          (err as { code?: string }).code === 'FAST_JWT_EXPIRED'
            ? 'Token expired'
            : 'Invalid token',
      });
    }
  });

  /**
   * Historial técnico: solo el superadmin. La consulta es global y el
   * `organizationId` es un filtro opcional, no el alcance obligatorio.
   */
  app.get('/', { preHandler: [requirePlatformAdmin()] }, async (request: FastifyRequest) => {
    const query = eventsQuerySchema.parse(request.query);
    return eventsService.listEvents(query);
  });

  app.get('/stats', { preHandler: [requirePlatformAdmin()] }, async (request: FastifyRequest) => {
    const query = request.query as {
      from?: string;
      to?: string;
      communityId?: string;
      organizationId?: string;
    };
    return eventsService.getEventStats(
      query.organizationId,
      query.from,
      query.to,
      query.communityId,
    );
  });
}

export async function internalEventsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    const key = request.headers['x-internal-key'];
    if (key !== config.internalApiKey) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }
  });

  app.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Record<string, unknown>;
    const eventId = body.eventId as string | undefined;
    const eventType = body.eventType as string | undefined;
    let organizationId = body.organizationId as string | undefined;
    const communityId = body.communityId as string | undefined;

    if (!eventId) {
      return reply.status(400).send({
        error: 'Validation failed',
        details: 'eventId is required',
      });
    }

    if (!eventType) {
      return reply.status(400).send({
        error: 'Validation failed',
        details: 'eventType is required',
      });
    }

    if (!organizationId && communityId) {
      organizationId = await eventsService.resolveOrgIdFromCommunityId(communityId);
    }

    if (!organizationId) {
      return reply.status(400).send({
        error: 'Validation failed',
        details: 'organizationId or communityId is required',
      });
    }

    const actor = body.actor as { id?: string; role?: string } | undefined;
    const actorId = (body.actorId as string | undefined) ?? actor?.id;
    const actorRole = (body.actorRole as string | undefined) ?? actor?.role;

    const envelope: EventEnvelope = {
      eventId,
      eventType,
      version: (body.version as number | undefined) ?? 1,
      occurredAt: (body.occurredAt as string | undefined) ?? new Date().toISOString(),
      organizationId,
      communityId: communityId ?? null,
      actor: actorId ? { id: actorId, role: actorRole ?? 'system' } : null,
      accessPointId: (body.accessPointId as string | undefined) ?? null,
      payload:
        (body.payload as Record<string, unknown> | undefined) ??
        (body.metadata as Record<string, unknown> | undefined) ??
        {},
    };

    const result = await eventsService.ingestEnvelope(envelope);

    return reply
      .status(result.duplicate ? 200 : 201)
      .send({ ok: true, duplicate: result.duplicate });
  });
}
