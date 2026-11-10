import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { CreateAccessPointDto, UpdateAccessPointDto } from '@porteria/shared';
import { requireRole } from '../middlewares/rbac.js';
import { createAccessPointSchema, updateAccessPointSchema } from '../schemas/index.js';
import {
  createAccessPoint,
  deactivateAccessPoint,
  listAccessPoints,
  updateAccessPoint,
  type AccessPointRequester,
  type AccessPointResult,
} from '../services/access-point.service.js';

function getRequester(request: FastifyRequest): AccessPointRequester {
  const user = request.user;
  return {
    sub: user.sub,
    role: user.role,
    orgId: user.orgId,
    communityId: user.communityId ?? null,
    isPlatformAdmin: Boolean(user.isPlatformAdmin),
  };
}

function sendError<T>(reply: FastifyReply, result: Extract<AccessPointResult<T>, { ok: false }>) {
  const status =
    result.code === 'not_found'
      ? 404
      : result.code === 'conflict'
        ? 409
        : result.code === 'forbidden'
          ? 403
          : 400;
  const error =
    status === 404
      ? 'Not Found'
      : status === 409
        ? 'Conflict'
        : status === 403
          ? 'Forbidden'
          : 'Bad Request';
  return reply.status(status).send({ statusCode: status, error, message: result.code });
}

export async function accessPointRoutes(app: FastifyInstance) {
  app.addHook('onRequest', async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch (error) {
      const code = (error as { code?: string }).code;
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: code === 'FAST_JWT_EXPIRED' ? 'Token expired' : 'Invalid token',
      });
    }
  });

  app.get(
    '/:communityId/access-points',
    { preHandler: [requireRole('org_admin', 'community_admin', 'guard')] },
    async (request, reply) => {
      const { communityId } = request.params as { communityId: string };
      const query = request.query as { includeInactive?: string };
      const result = await listAccessPoints(
        getRequester(request),
        communityId,
        query.includeInactive === 'true',
      );
      if (!result.ok) return sendError(reply, result);
      return reply.send({ items: result.data });
    },
  );

  app.post(
    '/:communityId/access-points',
    { preHandler: [requireRole('org_admin', 'community_admin')] },
    async (request, reply) => {
      const { communityId } = request.params as { communityId: string };
      const body = createAccessPointSchema.parse(request.body) as CreateAccessPointDto;
      const result = await createAccessPoint(getRequester(request), communityId, body);
      if (!result.ok) return sendError(reply, result);
      return reply.status(201).send(result.data);
    },
  );

  app.patch(
    '/:communityId/access-points/:id',
    { preHandler: [requireRole('org_admin', 'community_admin')] },
    async (request, reply) => {
      const { communityId, id } = request.params as { communityId: string; id: string };
      const body = updateAccessPointSchema.parse(request.body) as UpdateAccessPointDto;
      const result = await updateAccessPoint(getRequester(request), communityId, id, body);
      if (!result.ok) return sendError(reply, result);
      return reply.send(result.data);
    },
  );

  app.delete(
    '/:communityId/access-points/:id',
    { preHandler: [requireRole('org_admin', 'community_admin')] },
    async (request, reply) => {
      const { communityId, id } = request.params as { communityId: string; id: string };
      const result = await deactivateAccessPoint(getRequester(request), communityId, id);
      if (!result.ok) return sendError(reply, result);
      return reply.send(result.data);
    },
  );
}
