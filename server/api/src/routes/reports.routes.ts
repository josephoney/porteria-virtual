import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { requireRole } from '../middlewares/rbac.js';
import * as reportsService from '../services/reports.service.js';

function getUser(request: FastifyRequest) {
  const u = (request as any).user;
  return { sub: u.sub, role: u.role, orgId: u.orgId };
}

export async function reportsRoutes(app: FastifyInstance) {
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

  app.addHook('preHandler', requireRole('admin', 'operator'));

  app.get('/daily', async (request: FastifyRequest) => {
    const u = getUser(request);
    const query = request.query as { date?: string };
    return reportsService.getDailyReport(u.orgId, query.date);
  });

  app.get('/weekly', async (request: FastifyRequest) => {
    const u = getUser(request);
    const query = request.query as { week?: string };
    return reportsService.getWeeklyReport(u.orgId, query.week);
  });

  app.get('/monthly', async (request: FastifyRequest) => {
    const u = getUser(request);
    const query = request.query as { month?: string };
    return reportsService.getMonthlyReport(u.orgId, query.month);
  });

  app.get('/call-stats', async (request: FastifyRequest) => {
    const u = getUser(request);
    const query = request.query as { from?: string; to?: string };
    return reportsService.getCallStats(u.orgId, query.from, query.to);
  });

  app.get('/event-breakdown', async (request: FastifyRequest, reply: FastifyReply) => {
    const u = getUser(request);
    const query = request.query as { from: string; to: string; bucket?: 'hour' | 'day' };
    if (!query.from || !query.to) {
      return reply.status(400).send({ error: 'from and to query params are required' });
    }
    return reportsService.getEventBreakdown(u.orgId, query.from, query.to, query.bucket);
  });
}
