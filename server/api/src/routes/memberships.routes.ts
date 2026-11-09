import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { requireRole } from '../middlewares/rbac.js';
import * as membershipsService from '../services/memberships.service.js';
import { createMembershipSchema, updateMembershipSchema } from '../schemas/index.js';

function getRequester(request: FastifyRequest): membershipsService.Requester {
  const u = request.user;
  return {
    sub: u.sub,
    role: u.role,
    orgId: u.orgId,
    communityId: u.communityId ?? null,
    isPlatformAdmin: Boolean(u.isPlatformAdmin),
  };
}

export async function membershipRoutes(app: FastifyInstance) {
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

  app.post(
    '/',
    { preHandler: [requireRole('org_admin', 'community_admin')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const requester = getRequester(request);
      const body = createMembershipSchema.parse(request.body);
      const result = await membershipsService.createMembership(body, requester);

      if (result.error) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Validation failed',
          message: result.error,
        });
      }


      return reply.status(201).send(result.membership);
    },
  );

  app.patch(
    '/:id',
    { preHandler: [requireRole('org_admin', 'community_admin')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const requester = getRequester(request);
      const { id } = request.params as { id: string };
      const body = updateMembershipSchema.parse(request.body);
      const result = await membershipsService.updateMembership(id, body, requester);

      if (result.notFound) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: 'Membership not found',
        });
      }
      if (result.error) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Validation failed',
          message: result.error,
        });
      }


      return result.membership;
    },
  );
}
