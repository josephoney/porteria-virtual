import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { requireRole } from '../middlewares/rbac.js';
import * as eventsService from '../services/events.service.js';
import { eventsQuerySchema } from '../schemas/index.js';
import config from '../config.js';
import type { EventEnvelope } from '@porteria/shared';

function getUser(request: FastifyRequest) {
  const u = request.user;
  return {
    sub: u.sub,
    role: u.role,
    orgId: u.orgId,
    communityId: u.communityId ?? null,
    isPlatformAdmin: Boolean(u.isPlatformAdmin),
  };
}

function effectiveCommunityId(
  user: { role: string; communityId: string | null; isPlatformAdmin: boolean },
  requested?: string,
): string | undefined {
  if (user.isPlatformAdmin) return requested;
  if (user.role === 'org_admin') return requested;
  return user.communityId ?? requested ?? undefined;
}

export async function eventsRoutes(app: FastifyInstance) {
  app.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
    } catch (err) {
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: (err as { code?: string }).code === 'FAST_JWT_EXPIRED' ? 'Token expired' : 'Invalid token',
      });
    }
  });

  app.get(
    '/',
    { preHandler: [requireRole('org_admin', 'community_admin', 'operator', 'guard')] },
    async (request: FastifyRequest) => {
      const u = getUser(request);
      const query = eventsQuerySchema.parse(request.query);
      return eventsService.listEvents(u.orgId, {
        ...query,
        communityId: effectiveCommunityId(u, query.communityId),
      });
    },
  );

  app.get(
    '/stats',
    { preHandler: [requireRole('org_admin', 'community_admin', 'operator', 'guard')] },
    async (request: FastifyRequest) => {
      const u = getUser(request);
      const query = request.query as { from?: string; to?: string; communityId?: string };
      return eventsService.getEventStats(
        u.orgId,
        query.from,
        query.to,
        effectiveCommunityId(u, query.communityId),
      );
    },
  );
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
