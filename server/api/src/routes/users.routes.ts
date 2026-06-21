import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { requireRole, requireSelfOrRole } from '../middlewares/rbac.js';
import * as usersService from '../services/users.service.js';
import * as eventsService from '../services/events.service.js';
import { createUserSchema, updateUserSchema, changePasswordSchema } from '../schemas/index.js';

function getUser(request: FastifyRequest) {
  const u = (request as any).user;
  return {
    sub: u.sub,
    role: u.role,
    orgId: u.orgId,
  };
}

export async function userRoutes(app: FastifyInstance) {
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

  app.get('/me', async (request: FastifyRequest) => {
    const u = getUser(request);
    return usersService.getMe(u.sub);
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
    { preHandler: [requireRole('admin')] },
    async (request: FastifyRequest) => {
      const u = getUser(request);
      const query = request.query as { page?: string; pageSize?: string };
      const page = parseInt(query.page || '1', 10);
      const pageSize = Math.min(parseInt(query.pageSize || '20', 10), 100);
      return usersService.listUsers(u.orgId, page, pageSize);
    },
  );

  app.get(
    '/users/:id',
    { preHandler: [requireSelfOrRole('admin')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const u = getUser(request);
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
    { preHandler: [requireRole('admin')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const u = getUser(request);
      const body = createUserSchema.parse(request.body);
      const result = await usersService.createUser(body, u.orgId);
      if (!result) {
        return reply.status(409).send({ statusCode: 409, error: 'Conflict', message: 'Email already in use' });
      }

      eventsService.insertEvent({
        eventType: 'user.created',
        actorId: u.sub,
        actorRole: u.role,
        organizationId: u.orgId,
        metadata: { createdUserId: result.id, createdUserRole: result.role },
      }).catch(() => {});

      return reply.status(201).send(result);
    },
  );

  app.patch(
    '/users/:id',
    { preHandler: [requireRole('admin')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const u = getUser(request);
      const { id } = request.params as { id: string };
      const body = updateUserSchema.parse(request.body);
      const result = await usersService.updateUser(id, body, u.orgId);
      if (!result) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'User not found' });
      }

      const changedFields: string[] = [];
      if (body.name !== undefined) changedFields.push('name');
      if (body.role !== undefined) changedFields.push('role');
      if (body.active !== undefined) changedFields.push('active');
      if (body.locationId !== undefined) changedFields.push('locationId');

      if (changedFields.length > 0) {
        eventsService.insertEvent({
          eventType: 'user.updated',
          actorId: u.sub,
          actorRole: u.role,
          organizationId: u.orgId,
          metadata: { updatedUserId: id, changedFields },
        }).catch(() => {});
      }

      return result;
    },
  );
}
