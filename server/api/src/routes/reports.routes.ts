import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import * as reportsService from '../services/reports.service.js';
import { can } from '../services/admin-permissions.service.js';

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

function resolveReportScope(
  user: ReturnType<typeof getUser>,
  query: { organizationId?: string; communityId?: string },
  reply: FastifyReply,
): { organizationId: string; communityId: string | undefined } | null {
  if (user.isPlatformAdmin) {
    const organizationId = query.organizationId?.trim();
    if (!organizationId) {
      reply.status(400).send({ error: 'organizationId is required for platform reports' });
      return null;
    }
    return { organizationId, communityId: query.communityId?.trim() || undefined };
  }

  const communityId = effectiveCommunityId(user, query.communityId);
  if (!can(user, 'reports.read', { organizationId: user.orgId, communityId })) {
    reply.status(403).send({ error: 'Forbidden' });
    return null;
  }
  return { organizationId: user.orgId, communityId };
}

export async function reportsRoutes(app: FastifyInstance) {
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

  app.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    const u = getUser(request);
    if (u.isPlatformAdmin) return;
    if (!['org_admin', 'community_admin', 'operator', 'guard'].includes(u.role)) {
      return reply.status(403).send({ error: 'Forbidden' });
    }
  });

  app.get('/daily', async (request: FastifyRequest, reply: FastifyReply) => {
    const u = getUser(request);
    const query = request.query as { date?: string; communityId?: string; organizationId?: string };
    const scope = resolveReportScope(u, query, reply);
    if (!scope) return;
    return reportsService.getDailyReport(scope.organizationId, query.date, scope.communityId);
  });

  app.get('/weekly', async (request: FastifyRequest, reply: FastifyReply) => {
    const u = getUser(request);
    const query = request.query as { week?: string; communityId?: string; organizationId?: string };
    const scope = resolveReportScope(u, query, reply);
    if (!scope) return;
    return reportsService.getWeeklyReport(scope.organizationId, query.week, scope.communityId);
  });

  app.get('/monthly', async (request: FastifyRequest, reply: FastifyReply) => {
    const u = getUser(request);
    const query = request.query as { month?: string; communityId?: string; organizationId?: string };
    const scope = resolveReportScope(u, query, reply);
    if (!scope) return;
    return reportsService.getMonthlyReport(scope.organizationId, query.month, scope.communityId);
  });

  app.get('/call-stats', async (request: FastifyRequest, reply: FastifyReply) => {
    const u = getUser(request);
    const query = request.query as {
      from?: string;
      to?: string;
      communityId?: string;
      organizationId?: string;
    };
    const scope = resolveReportScope(u, query, reply);
    if (!scope) return;
    return reportsService.getCallStats(scope.organizationId, query.from, query.to, scope.communityId);
  });

  app.get('/event-breakdown', async (request: FastifyRequest, reply: FastifyReply) => {
    const u = getUser(request);
    const query = request.query as {
      from: string;
      to: string;
      bucket?: 'hour' | 'day';
      communityId?: string;
      organizationId?: string;
    };
    if (!query.from || !query.to) {
      return reply.status(400).send({ error: 'from and to query params are required' });
    }
    const scope = resolveReportScope(u, query, reply);
    if (!scope) return;
    return reportsService.getEventBreakdown(
      scope.organizationId,
      query.from,
      query.to,
      query.bucket,
      scope.communityId,
    );
  });
}
