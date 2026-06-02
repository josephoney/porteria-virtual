import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import * as authService from '../services/auth.service.js';
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
    await authService.logout(body.refreshToken);

    return reply.status(200).send({ message: 'Logged out' });
  });
}
