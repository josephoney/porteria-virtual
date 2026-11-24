import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import * as reportsService from '../services/reports.service.js';
import * as reportExportService from '../services/report-export.service.js';
import { can } from '../services/admin-permissions.service.js';
import { parseLocalDate, toLocalDateString } from '../lib/report-dates.js';

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

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Valida `YYYY-MM-DD` como fecha local real (rechaza 2026-02-31). */
function parseReportPeriod(
  query: { from?: string; to?: string },
  reply: FastifyReply,
): { from: string; to: string } | null {
  const from = query.from?.trim();
  const to = query.to?.trim();
  if (!from || !to) {
    reply.status(400).send({ error: 'Los parámetros from y to son obligatorios' });
    return null;
  }
  for (const value of [from, to]) {
    const parsed = parseLocalDate(value);
    if (!DATE_PATTERN.test(value) || toLocalDateString(parsed) !== value) {
      reply.status(400).send({ error: 'Las fechas deben tener el formato YYYY-MM-DD' });
      return null;
    }
  }
  if (from > to) {
    reply.status(400).send({ error: 'from no puede ser posterior a to' });
    return null;
  }
  return { from, to };
}

const GRANULARITIES = new Set(['day', 'week', 'month']);

function parseGranularity(value: string | undefined, reply: FastifyReply) {
  const granularity = (value?.trim() || 'day') as 'day' | 'week' | 'month';
  if (!GRANULARITIES.has(granularity)) {
    reply.status(400).send({ error: 'La granularidad debe ser day, week o month' });
    return null;
  }
  return granularity;
}

export async function reportsRoutes(app: FastifyInstance) {
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
    const query = request.query as {
      month?: string;
      communityId?: string;
      organizationId?: string;
    };
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
    return reportsService.getCallStats(
      scope.organizationId,
      query.from,
      query.to,
      scope.communityId,
    );
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

  /**
   * Reporte de accesos. `from` y `to` son días locales (`YYYY-MM-DD`) y
   * `granularity` controla la serie: `day` (default), `week` o `month`.
   */
  app.get('/access', async (request: FastifyRequest, reply: FastifyReply) => {
    const u = getUser(request);
    const query = request.query as {
      from?: string;
      to?: string;
      granularity?: string;
      communityId?: string;
      organizationId?: string;
    };
    const period = parseReportPeriod(query, reply);
    if (!period) return;
    const granularity = parseGranularity(query.granularity, reply);
    if (!granularity) return;
    const scope = resolveReportScope(u, query, reply);
    if (!scope) return;
    return reportsService.getAccessReport(scope, period.from, period.to, granularity);
  });

  /** Reporte de turnos; el período se evalúa sobre `guard_shifts.started_at`. */
  app.get('/shifts', async (request: FastifyRequest, reply: FastifyReply) => {
    const u = getUser(request);
    const query = request.query as {
      from?: string;
      to?: string;
      communityId?: string;
      organizationId?: string;
    };
    const period = parseReportPeriod(query, reply);
    if (!period) return;
    const scope = resolveReportScope(u, query, reply);
    if (!scope) return;
    return reportsService.getShiftReport(scope, period.from, period.to);
  });

  /**
   * Exportación de un reporte. Reutiliza los mismos constructores que la
   * pantalla, así el archivo y lo que se ve en pantalla no pueden diferir.
   */
  app.get('/export', async (request: FastifyRequest, reply: FastifyReply) => {
    const u = getUser(request);
    const query = request.query as {
      report?: string;
      format?: string;
      from?: string;
      to?: string;
      granularity?: string;
      communityId?: string;
      organizationId?: string;
    };

    const report = query.report?.trim();
    if (!reportExportService.isReportFamily(report)) {
      return reply.status(400).send({ error: 'El reporte debe ser access o shifts' });
    }

    const format = query.format?.trim();
    if (!reportExportService.isExportFormat(format)) {
      return reply.status(400).send({ error: 'El formato debe ser csv, xlsx o pdf' });
    }

    const period = parseReportPeriod(query, reply);
    if (!period) return;

    const granularity = parseGranularity(query.granularity, reply);
    if (!granularity) return;

    const scope = resolveReportScope(u, query, reply);
    if (!scope) return;

    const file = await reportExportService.buildExportFile({
      report,
      format,
      scope,
      from: period.from,
      to: period.to,
      granularity,
    });

    return reply
      .header('Content-Type', file.contentType)
      .header('Content-Disposition', `attachment; filename="${file.filename}"`)
      .send(file.body);
  });
}
