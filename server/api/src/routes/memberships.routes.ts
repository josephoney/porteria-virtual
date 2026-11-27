import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { AssignWorkstationDto } from '@porteria/shared';
import { requireRole } from '../middlewares/rbac.js';
import * as membershipsService from '../services/memberships.service.js';
import type { WorkstationErrorCode } from '../services/workstation.service.js';
import { assignWorkstation } from '../services/workstation.service.js';
import {
  assignWorkstationSchema,
  createMembershipSchema,
  updateMembershipSchema,
} from '../schemas/index.js';

function getRequester(request: FastifyRequest): membershipsService.Requester & {
  personId: string | null;
} {
  const u = request.user;
  return {
    sub: u.sub,
    personId: u.personId ?? null,
    membershipId: u.membershipId ?? null,
    role: u.role,
    orgId: u.orgId,
    communityId: u.communityId ?? null,
    isPlatformAdmin: Boolean(u.isPlatformAdmin),
  };
}

function workstationStatus(code: WorkstationErrorCode): 400 | 403 | 404 {
  if (code === 'not_found') return 404;
  if (code === 'forbidden' || code === 'tenant_read_only') return 403;
  return 400;
}

function deleteStatus(error: string): 400 | 403 | 409 {
  if (error === 'last_org_admin' || error === 'own_active_membership' || error === 'open_shift') {
    return 409;
  }
  if (
    error === 'Role out of scope' ||
    error === 'Insufficient permissions' ||
    error === 'tenant_read_only'
  ) {
    return 403;
  }
  return 400;
}

export async function membershipRoutes(app: FastifyInstance) {
  app.addHook('onRequest', async (request, reply) => {
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

  /**
   * Puesto de trabajo del guardia.
   *
   * Es la única puerta de escritura del campo: el `PATCH` de la membresía delega
   * acá, así que las reglas viven en un solo lugar.
   */
  app.put(
    '/:id/workstation',
    { preHandler: [requireRole('org_admin', 'community_admin')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const requester = getRequester(request);
      const { id } = request.params as { id: string };
      const body = assignWorkstationSchema.parse(request.body) as AssignWorkstationDto;

      const result = await assignWorkstation({
        requester,
        membershipId: id,
        accessPointId: body.accessPointId,
      });

      if (!result.ok) {
        const status = workstationStatus(result.code);
        return reply.status(status).send({
          statusCode: status,
          error: status === 404 ? 'Not Found' : status === 403 ? 'Forbidden' : 'Bad Request',
          message: result.code,
          code: result.code,
        });
      }

      return reply.send(result.data);
    },
  );

  app.delete(
    '/:id',
    { preHandler: [requireRole('org_admin', 'community_admin')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const requester = getRequester(request);
      const { id } = request.params as { id: string };
      const result = await membershipsService.deleteMembership(id, requester);

      if ('notFound' in result) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: 'Membership not found',
        });
      }
      if ('error' in result) {
        const status = deleteStatus(result.error);
        const error = status === 403 ? 'Forbidden' : status === 409 ? 'Conflict' : 'Bad Request';
        return reply.status(status).send({
          statusCode: status,
          error,
          message: result.error,
          code: result.error,
        });
      }

      return reply.send({ deleted: true });
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
