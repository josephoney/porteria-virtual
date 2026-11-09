import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { requireRole } from '../middlewares/rbac.js';
import * as callsService from '../services/calls.service.js';
import { callsQuerySchema } from '../schemas/index.js';
import config from '../config.js';
import type { CreateCallDto, UpdateCallDto } from '@porteria/shared';

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

export async function callsRoutes(app: FastifyInstance) {
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
    { preHandler: [requireRole('org_admin', 'community_admin', 'operator')] },
    async (request: FastifyRequest) => {
      const u = getUser(request);
      const query = callsQuerySchema.parse(request.query);
      const effectiveOperatorId = u.role === 'operator' ? u.sub : query.operatorId;

      return callsService.listCalls(u.orgId, {
        ...query,
        operatorId: effectiveOperatorId,
        communityId: effectiveCommunityId(u, query.communityId),
      });
    },
  );

  app.get(
    '/:id',
    { preHandler: [requireRole('org_admin', 'community_admin', 'operator')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const u = getUser(request);
      const { id } = request.params as { id: string };
      const result = await callsService.getCallById(id, u.orgId);
      if (!result) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: 'Call not found',
        });
      }
      return result;
    },
  );
}

export async function internalCallsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    const key = request.headers['x-internal-key'];
    if (key !== config.internalApiKey) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }
  });

  app.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as CreateCallDto;
    const result = await callsService.createCall(body);
    if (!result.success) {
      return reply.status(400).send(result);
    }
    return reply.status(201).send(result);
  });

  app.patch('/:callId', async (request: FastifyRequest, reply: FastifyReply) => {
    const { callId } = request.params as { callId: string };
    const body = request.body as UpdateCallDto;
    const result = await callsService.updateCall(callId, body);
    if (!result.success) {
      const status = result.error === 'No fields to update' ? 400 : 404;
      return reply.status(status).send(result);
    }
    return reply.status(200).send(result);
  });
}
