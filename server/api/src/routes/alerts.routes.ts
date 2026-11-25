import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import { requireRole } from '../middlewares/rbac.js';
import {
  listAlerts,
  resolveAlert,
  type AlertRequester,
  type AlertResult,
} from '../services/alerts.service.js';

interface AlertUser {
  sub: string;
  accountId?: string | null;
  personId?: string | null;
  orgId: string;
  communityId?: string | null;
  role: string;
  isPlatformAdmin?: boolean;
}

function getUser(request: FastifyRequest): AlertUser {
  return request.user as AlertUser;
}

function toRequester(user: AlertUser, organizationId?: string | null): AlertRequester {
  return {
    accountId: user.accountId ?? null,
    personId: user.personId ?? null,
    orgId: organizationId || user.orgId,
    communityId: user.communityId ?? null,
    role: user.role,
    isPlatformAdmin: Boolean(user.isPlatformAdmin),
  };
}

function sendAlertError(reply: FastifyReply, code: 'not_found' | 'conflict' | 'forbidden') {
  const status = code === 'not_found' ? 404 : code === 'conflict' ? 409 : 403;
  const message =
    code === 'not_found'
      ? 'La alerta no existe o está fuera de tu alcance'
      : code === 'conflict'
        ? 'La alerta ya está resuelta'
        : 'No tienes permiso para resolver alertas';
  return reply.status(status).send({ statusCode: status, error: message, message: code });
}

/**
 * Alertas de salida pendiente.
 *
 * Se resuelven solas cuando el visitante registra su salida; esta superficie
 * existe para el caso en que eso nunca ocurre y la alerta queda abierta.
 */
export async function alertsRoutes(app: FastifyInstance) {
  app.get(
    '/',
    { preHandler: [requireRole('guard', 'operator', 'community_admin', 'org_admin')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = getUser(request);
      const query = request.query as { status?: string; organizationId?: string };

      if (user.isPlatformAdmin && !query.organizationId) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'organization_required',
        });
      }

      const status =
        query.status === 'resolved' ? 'resolved' : query.status === 'all' ? 'all' : 'open';
      const alerts = await listAlerts(toRequester(user, query.organizationId), status);
      return alerts;
    },
  );

  app.post(
    '/:id/resolve',
    { preHandler: [requireRole('operator', 'community_admin', 'org_admin')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = getUser(request);
      const { id } = request.params as { id: string };
      const body = (request.body ?? {}) as { note?: unknown; organizationId?: string };

      if (user.isPlatformAdmin && !body.organizationId) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'organization_required',
        });
      }

      const note = typeof body.note === 'string' ? body.note.trim() : '';
      if (note.length < 5) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'La nota debe explicar por qué se cierra la alerta',
        });
      }

      const result: AlertResult<{ id: string; resolvedAt: string }> = await resolveAlert(
        toRequester(user, body.organizationId),
        id,
        note,
      );
      if (!result.ok) return sendAlertError(reply, result.code);
      return { data: result.data };
    },
  );
}
