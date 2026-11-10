import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type {
  ChangeAccessPointDto,
  EndShiftDto,
  ForceCloseShiftDto,
  StartShiftDto,
} from '@porteria/shared';
import { requireRole } from '../middlewares/rbac.js';
import {
  activeGuardsQuerySchema,
  changeAccessPointSchema,
  endShiftSchema,
  forceCloseShiftSchema,
  shiftsQuerySchema,
  startShiftSchema,
} from '../schemas/index.js';
import {
  changeAccessPoint,
  endShift,
  forceCloseShift,
  getCurrentShift,
  listActiveGuards,
  listShifts,
  startShift,
  type GuardShiftRequester,
  type GuardShiftResult,
} from '../services/guard-shift.service.js';

function getRequester(request: FastifyRequest): GuardShiftRequester {
  const user = request.user;
  return {
    sub: user.sub,
    accountId: user.accountId,
    personId: user.personId,
    role: user.role,
    orgId: user.orgId,
    communityId: user.communityId ?? null,
    membershipId: user.membershipId,
    isPlatformAdmin: Boolean(user.isPlatformAdmin),
  };
}

function sendError<T>(reply: FastifyReply, result: Extract<GuardShiftResult<T>, { ok: false }>) {
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

export async function guardShiftRoutes(app: FastifyInstance) {
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

  app.get('/shifts/current', { preHandler: [requireRole('guard')] }, async (request, reply) => {
    const result = await getCurrentShift(getRequester(request));
    if (!result.ok) return sendError(reply, result);
    return reply.send(result.data);
  });

  app.post('/shifts/start', { preHandler: [requireRole('guard')] }, async (request, reply) => {
    const body = startShiftSchema.parse(request.body ?? {}) as StartShiftDto;
    const result = await startShift(getRequester(request), body);
    if (!result.ok) return sendError(reply, result);
    return reply.status(201).send(result.data);
  });

  app.post(
    '/shifts/:id/change-access-point',
    { preHandler: [requireRole('guard')] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = changeAccessPointSchema.parse(request.body) as ChangeAccessPointDto;
      const result = await changeAccessPoint(getRequester(request), id, body);
      if (!result.ok) return sendError(reply, result);
      return reply.send(result.data);
    },
  );

  app.post('/shifts/:id/end', { preHandler: [requireRole('guard')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = endShiftSchema.parse(request.body ?? {}) as EndShiftDto;
    const result = await endShift(getRequester(request), id, body);
    if (!result.ok) return sendError(reply, result);
    return reply.send(result.data);
  });

  app.post(
    '/shifts/:id/force-close',
    { preHandler: [requireRole('community_admin', 'org_admin')] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = forceCloseShiftSchema.parse(request.body) as ForceCloseShiftDto;
      const result = await forceCloseShift(getRequester(request), id, body);
      if (!result.ok) return sendError(reply, result);
      return reply.send(result.data);
    },
  );

  app.get(
    '/shifts',
    { preHandler: [requireRole('guard', 'community_admin', 'org_admin')] },
    async (request, reply) => {
      const query = shiftsQuerySchema.parse(request.query);
      const result = await listShifts(getRequester(request), query);
      if (!result.ok) return sendError(reply, result);
      return reply.send(result.data);
    },
  );

  app.get(
    '/active-guards',
    { preHandler: [requireRole('community_admin', 'org_admin')] },
    async (request, reply) => {
      const query = activeGuardsQuerySchema.parse(request.query);
      const result = await listActiveGuards(
        getRequester(request),
        query.communityId,
        query.accessPointId,
      );
      if (!result.ok) return sendError(reply, result);
      return reply.send(result.data);
    },
  );
}
