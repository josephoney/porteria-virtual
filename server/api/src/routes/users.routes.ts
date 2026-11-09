import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { requireRole, requireSelfOrRole } from '../middlewares/rbac.js';
import * as usersService from '../services/users.service.js';
import { validateMembershipScope } from '../services/memberships.service.js';
import { canAssignRole } from '../services/role-policy.service.js';
import { validateLocationUnit } from '../services/location-unit.service.js';
import { can } from '../services/admin-permissions.service.js';
import type { MembershipRole } from '@porteria/shared';
import { createUserSchema, updateUserSchema, changePasswordSchema } from '../schemas/index.js';

function getUser(request: FastifyRequest): usersService.Requester {
  const u = request.user;
  return {
    sub: u.sub,
    role: u.role,
    orgId: u.orgId,
    communityId: u.communityId ?? null,
    isPlatformAdmin: Boolean(u.isPlatformAdmin),
  };
}

export async function userRoutes(app: FastifyInstance) {
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

  app.get('/me', async (request: FastifyRequest) => {
    const u = getUser(request);
    const profile = await usersService.getMe(u.sub);
    if (!profile) return null;
    return {
      ...profile,
      activeMembership: {
        id: request.user.membershipId,
        role: u.role,
        organizationId: u.orgId,
        communityId: u.communityId,
        unitId: request.user.unitId ?? null,
      },
    };
  });

  app.patch('/me/password', async (request: FastifyRequest, reply: FastifyReply) => {
    const u = getUser(request);
    const body = changePasswordSchema.parse(request.body);
    const ok = await usersService.changePassword(u.sub, body.currentPassword, body.newPassword);
    if (!ok) {
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Current password is incorrect',
      });
    }
    return { message: 'Password changed' };
  });

  app.get(
    '/users',
    { preHandler: [requireRole('org_admin', 'community_admin')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const u = getUser(request);
      if (!can(u, 'people.read', { organizationId: u.orgId, communityId: u.communityId })) {
        return reply.status(403).send({ statusCode: 403, error: 'Forbidden', message: 'Insufficient permissions' });
      }
      const query = request.query as {
        page?: string;
        pageSize?: string;
        communityId?: string;
        search?: string;
      };
      const page = parseInt(query.page || '1', 10);
      const pageSize = Math.min(parseInt(query.pageSize || '20', 10), 100);
      return usersService.listUsers(u, {
        page,
        pageSize,
        communityId: query.communityId,
        search: query.search?.trim() || undefined,
      });
    },
  );

  app.get(
    '/users/:id',
    { preHandler: [requireSelfOrRole('org_admin', 'community_admin')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const u = getUser(request);
      if (!can(u, 'people.read', { organizationId: u.orgId, communityId: u.communityId })) {
        return reply.status(403).send({ statusCode: 403, error: 'Forbidden', message: 'Insufficient permissions' });
      }
      const { id } = request.params as { id: string };
      const result = await usersService.getUserById(id, u);
      if (!result) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'User not found' });
      }
      return result;
    },
  );

  app.post(
    '/users',
    { preHandler: [requireRole('org_admin', 'community_admin')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const u = getUser(request);
      if (!can(u, 'people.write', { organizationId: u.orgId, communityId: u.communityId })) {
        return reply.status(403).send({ statusCode: 403, error: 'Forbidden', message: 'Insufficient permissions' });
      }
      const body = createUserSchema.parse(request.body);

      if (!canAssignRole(u, body.role as MembershipRole)) {
        return reply.status(403).send({
          statusCode: 403,
          error: 'Forbidden',
          message: 'No podés asignar ese rol',
        });
      }

      const communityId =
        u.role === 'community_admin' ? u.communityId : (body.communityId ?? null);
      const requestedCommunityIds = body.communityIds?.length
        ? body.communityIds
        : communityId
          ? [communityId]
          : [];
      if (
        u.role === 'community_admin' &&
        requestedCommunityIds.some((id) => id !== u.communityId)
      ) {
        return reply.status(403).send({
          statusCode: 403,
          error: 'Forbidden',
          message: 'Community out of scope',
        });
      }
      if (requestedCommunityIds.length > 1 && (body.unitId || body.locationUnitId)) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Validation failed',
          message: 'A multi-community user cannot have a unit assignment',
        });
      }
      const scopeError = validateMembershipScope(
        body.role,
        requestedCommunityIds[0] ?? communityId,
        body.locationUnitId ?? body.unitId,
      );
      if (scopeError) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Validation failed',
          message: scopeError,
        });
      }

      if (body.locationUnitId && communityId) {
        const location = await validateLocationUnit(body.locationUnitId, communityId);
        if (!location.ok) {
          const status = location.code === 'not_found' ? 404 : 400;
          return reply.status(status).send({
            statusCode: status,
            error: status === 404 ? 'Not Found' : 'Bad Request',
            message:
              location.code === 'not_found'
                ? 'Location unit not found in this community'
                : 'Location unit must be a leaf',
          });
        }
      }

      const result = await usersService.createUser(
        { ...body, communityId, communityIds: requestedCommunityIds },
        u,
      );
      if (!result) {
        return reply.status(409).send({
          statusCode: 409,
          error: 'Conflict',
          message: 'Email already in use',
        });
      }


      return reply.status(201).send(result);
    },
  );

  app.patch(
    '/users/:id',
    { preHandler: [requireRole('org_admin', 'community_admin')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const u = getUser(request);
      if (!can(u, 'people.write', { organizationId: u.orgId, communityId: u.communityId })) {
        return reply.status(403).send({ statusCode: 403, error: 'Forbidden', message: 'Insufficient permissions' });
      }
      const { id } = request.params as { id: string };
      const body = updateUserSchema.parse(request.body);
      const result = await usersService.updateUser(id, body, u);
      if (!result) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'User not found' });
      }

      return result;
    },
  );
}
