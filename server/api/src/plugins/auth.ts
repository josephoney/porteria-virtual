import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fjwt from '@fastify/jwt';
import config from '../config.js';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  orgId: string;
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

export async function authPlugin(app: FastifyInstance) {
  await app.register(fjwt, { secret: config.jwt.secret });

  app.decorate('authenticate', async function (request: FastifyRequest, reply: FastifyReply) {
    try {
      const decoded = app.jwt.verify<JwtPayload>(
        (request.headers.authorization || '').replace('Bearer ', ''),
      );
      (request as any).user = decoded;
    } catch (err: any) {
      reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: err.message?.includes('expired') ? 'Token expired' : 'Invalid token',
      });
    }
  });
}
