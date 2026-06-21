import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { requireRole } from '../middlewares/rbac.js';
import * as eventsService from '../services/events.service.js';
import { eventsQuerySchema } from '../schemas/index.js';
import config from '../config.js';

function getUser(request: FastifyRequest) {
  const u = (request as any).user;
  return { sub: u.sub, role: u.role, orgId: u.orgId };
}

export async function eventsRoutes(app: FastifyInstance) {
  app.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
    } catch (err: any) {
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: err.code === 'FAST_JWT_EXPIRED' ? 'Token expired' : 'Invalid token',
      });
    }
  });

  app.get(
    '/',
    { preHandler: [requireRole('admin', 'operator')] },
    async (request: FastifyRequest) => {
      const u = getUser(request);
      const query = eventsQuerySchema.parse(request.query);
      return eventsService.listEvents(u.orgId, query);
    },
  );

  app.get(
    '/stats',
    { preHandler: [requireRole('admin', 'operator')] },
    async (request: FastifyRequest) => {
      const u = getUser(request);
      const query = request.query as { from?: string; to?: string };
      return eventsService.getEventStats(u.orgId, query.from, query.to);
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

    const eventType = body.eventType as string;
    let organizationId = body.organizationId as string;
    const buildingId = body.buildingId as string;

    if (!eventType) {
      return reply.status(400).send({
        error: 'Validation failed',
        details: 'eventType is required',
      });
    }

    if (!organizationId && buildingId) {
      organizationId = await eventsService.resolveOrgIdFromBuildingId(buildingId);
    }

    if (!organizationId) {
      return reply.status(400).send({
        error: 'Validation failed',
        details: 'organizationId or buildingId is required',
      });
    }

    await eventsService.insertEvent({
      eventType,
      organizationId,
      actorId: body.actorId as string | undefined,
      actorRole: body.actorRole as string | undefined,
      locationId: body.locationId as string | undefined,
      accessPointId: body.accessPointId as string | undefined,
      metadata: body.metadata as Record<string, unknown> | undefined,
    });

    return reply.status(201).send({ ok: true });
  });
}
