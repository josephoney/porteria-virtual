import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import * as authService from '../services/auth.service.js';
import * as eventsService from '../services/events.service.js';
import { loginSchema, refreshSchema } from '../schemas/index.js';

export async function authRoutes(app: FastifyInstance) {
  app.post('/login', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = loginSchema.parse(request.body);
    const result = await authService.login(body.email, body.password);

    if (!result) {
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Invalid email or password',
      });
    }

    eventsService.insertEvent({
      eventType: 'user.login',
      actorId: result.user.id,
      actorRole: result.user.role,
      organizationId: result.user.organizationId,
    }).catch(() => {});

    return reply.status(200).send(result);
  });

  app.post('/refresh', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = refreshSchema.parse(request.body);
    const result = await authService.refreshToken(body.refreshToken);

    if (!result) {
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Invalid or expired refresh token',
      });
    }

    return reply.status(200).send(result);
  });

  app.post('/logout', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = refreshSchema.parse(request.body);
    const userInfo = await authService.getUserByRefreshToken(body.refreshToken);
    await authService.logout(body.refreshToken);

    if (userInfo) {
      eventsService.insertEvent({
        eventType: 'user.logout',
        actorId: userInfo.userId,
        actorRole: userInfo.role,
        organizationId: userInfo.organizationId,
      }).catch(() => {});
    }

    return reply.status(200).send({ message: 'Logged out' });
  });
}
