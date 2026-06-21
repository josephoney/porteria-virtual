import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { requireRole } from '../middlewares/rbac.js';
import * as kiosksService from '../services/kiosks.service.js';
import * as callsService from '../services/calls.service.js';
import * as eventsService from '../services/events.service.js';
import { kiosksQuerySchema } from '../schemas/index.js';

function getUser(request: FastifyRequest) {
  const u = (request as any).user;
  return { sub: u.sub, role: u.role, orgId: u.orgId };
}

export async function kiosksRoutes(app: FastifyInstance) {
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
      const query = kiosksQuerySchema.parse(request.query);
      return kiosksService.listKiosks(u.orgId, query);
    },
  );
}

export async function dashboardRoutes(app: FastifyInstance) {
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
    '/stats',
    { preHandler: [requireRole('admin', 'operator')] },
    async (request: FastifyRequest) => {
      const u = getUser(request);
      const query = request.query as { from?: string; to?: string };
      const [totalKiosks, callsToday, eventsToday, activeCalls] = await Promise.all([
        kiosksService.getKiosksCount(u.orgId),
        callsService.getCallsTodayCount(u.orgId, query.from, query.to),
        eventsService.getEventsTodayCount(u.orgId, query.from, query.to),
        callsService.getActiveCallsCount(u.orgId),
      ]);

      return { totalKiosks, callsToday, eventsToday, activeCalls };
    },
  );
}
