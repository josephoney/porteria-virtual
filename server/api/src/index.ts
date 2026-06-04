import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });
import Fastify from 'fastify';
import fjwt from '@fastify/jwt';
import cors from '@fastify/cors';
import config, { validateConfig } from './config.js';
import { errorHandler } from './plugins/error-handler.js';
import { createDb } from '@porteria/database';

export async function buildApp() {
  const warnings = validateConfig();
  const app = Fastify({ logger: true });

  // Core plugins
  await app.register(cors, { origin: true, credentials: true });
  await app.register(errorHandler);
  await app.register(fjwt, { secret: config.jwt.secret });

  app.addHook('onRequest', async (_request, reply) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('X-Frame-Options', 'DENY');
  });

  // Database
  try {
    const db = createDb();
    app.decorate('db', db);
    app.log.info('Database connected');
  } catch (err) {
    app.log.error('Database connection failed');
    throw err;
  }

  if (warnings.length > 0) {
    app.log.warn({ warnings }, 'Configuration warnings');
  }

  // Health
  app.get('/health', async () => ({
    status: 'ok',
    service: 'api',
    timestamp: Date.now(),
  }));

  // Auth middleware factory
  const authenticate = async (request: any, reply: any) => {
    try {
      await request.jwtVerify();
    } catch (err: any) {
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: err.code === 'FAST_JWT_EXPIRED' ? 'Token expired' : 'Invalid token',
      });
    }
  };

  // Routes
  const { authRoutes } = await import('./routes/auth.routes.js');
  await app.register(authRoutes, { prefix: '/api/auth' });

  const { userRoutes } = await import('./routes/users.routes.js');
  await app.register(userRoutes, { prefix: '/api' });

  return { app, authenticate };
}

export async function start() {
  const { app } = await buildApp();
  try {
    await app.listen({ port: config.port, host: config.host });
    return app;
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

const isMainModule = process.argv[1]?.includes('index');
if (isMainModule) {
  start();
}
