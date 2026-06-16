import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { requireRole } from '../middlewares/rbac.js';
import * as eventsService from '../services/events.service.js';
import { eventsQuerySchema } from '../schemas/index.js';

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
      return eventsService.getEventStats(u.orgId);
    },
  );
}
