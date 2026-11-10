import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });
import Fastify, { type FastifyRequest, type FastifyReply } from 'fastify';
import fjwt from '@fastify/jwt';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import { registerMembershipGuard } from './plugins/auth.js';
import { startOutboxWorker, stopOutboxWorker } from './workers/outbox.worker.js';
import config, { validateConfig } from './config.js';
import { errorHandler } from './plugins/error-handler.js';
import { createDb } from '@porteria/database';
import { redactSensitiveUrl } from './lib/log-redaction.js';

export async function buildApp() {
  const warnings = validateConfig();
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
      serializers: {
        req(request: FastifyRequest) {
          return {
            method: request.method,
            url: redactSensitiveUrl(request.url),
            host: request.hostname,
            remoteAddress: request.ip,
          };
        },
      },
    },
  });

  // Core plugins
  await app.register(cors, { origin: true, credentials: true });
  await app.register(multipart, { limits: { fileSize: 500 * 1024 } });
  await app.register(errorHandler);
  await app.register(fjwt, { secret: config.jwt.secret });
  registerMembershipGuard(app);

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

  app.get('/api/features', async () => config.features);

  // Auth middleware factory
  const authenticate = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
    } catch (err) {
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message:
          (err as { code?: string }).code === 'FAST_JWT_EXPIRED'
            ? 'Token expired'
            : 'Invalid token',
      });
    }
  };

  // Routes
  const { authRoutes } = await import('./routes/auth.routes.js');
  await app.register(authRoutes, { prefix: '/api/auth' });

  const { publicRoutes } = await import('./routes/public.routes.js');
  await app.register(publicRoutes, { prefix: '/api/public' });

  const { invitationRoutes } = await import('./routes/invitations.routes.js');
  await app.register(invitationRoutes, { prefix: '/api/invitations' });

  const { platformRoutes } = await import('./routes/platform.routes.js');
  await app.register(platformRoutes, { prefix: '/api/platform' });

  const { userRoutes } = await import('./routes/users.routes.js');
  await app.register(userRoutes, { prefix: '/api' });

  const { peopleRoutes } = await import('./routes/people.routes.js');
  await app.register(peopleRoutes, { prefix: '/api/people' });

  const { assetRoutes } = await import('./routes/assets.routes.js');
  await app.register(assetRoutes, { prefix: '/api/assets' });

  const { membershipRoutes } = await import('./routes/memberships.routes.js');
  await app.register(membershipRoutes, { prefix: '/api/memberships' });

  const { communityRoutes } = await import('./routes/communities.routes.js');
  await app.register(communityRoutes, { prefix: '/api/communities' });

  const { organizationAdminRoutes } = await import('./routes/organization-admin.routes.js');
  await app.register(organizationAdminRoutes, { prefix: '/api/organizations' });

  const { sectionRoutes } = await import('./routes/sections.routes.js');
  await app.register(sectionRoutes, { prefix: '/api/sections' });

  const { unitRoutes } = await import('./routes/units.routes.js');
  await app.register(unitRoutes, { prefix: '/api/units' });

  const { structureRoutes } = await import('./routes/structures.routes.js');
  await app.register(structureRoutes, { prefix: '/api/location-structures' });
  await app.register(structureRoutes, {
    prefix: '/api/communities/:communityId/location-structures',
  });

  const { locationNodeRoutes } = await import('./routes/location-nodes.routes.js');
  await app.register(locationNodeRoutes, { prefix: '/api/location-units' });

  const { callsRoutes } = await import('./routes/calls.routes.js');
  await app.register(callsRoutes, { prefix: '/api/calls' });

  const { internalCallsRoutes } = await import('./routes/calls.routes.js');
  await app.register(internalCallsRoutes, { prefix: '/api/internal/calls' });

  const { eventsRoutes, internalEventsRoutes } = await import('./routes/events.routes.js');
  await app.register(eventsRoutes, { prefix: '/api/events' });
  await app.register(internalEventsRoutes, { prefix: '/api/internal/events' });

  const { kiosksRoutes, dashboardRoutes, internalKioskRoutes } =
    await import('./routes/kiosks.routes.js');
  await app.register(kiosksRoutes, { prefix: '/api/kiosks' });
  await app.register(dashboardRoutes, { prefix: '/api/dashboard' });
  await app.register(internalKioskRoutes, { prefix: '/api/internal/kiosks' });

  const { relaysRoutes, internalRelayRoutes } = await import('./routes/relays.routes.js');
  await app.register(relaysRoutes, { prefix: '/api/kiosks' });
  await app.register(internalRelayRoutes, { prefix: '/api/internal/relays' });

  const { reportsRoutes } = await import('./routes/reports.routes.js');
  await app.register(reportsRoutes, { prefix: '/api/reports' });

  const { internalOutboxRoutes } = await import('./routes/outbox.routes.js');
  await app.register(internalOutboxRoutes, { prefix: '/api/internal/outbox' });

  const { passRoutes } = await import('./routes/pass.routes.js');
  await app.register(passRoutes, { prefix: '/api/passes' });

  const { publicPassRoutes } = await import('./routes/public-pass.routes.js');
  await app.register(publicPassRoutes, { prefix: '/api/public/passes' });

  const { accessRoutes } = await import('./routes/access.routes.js');
  await app.register(accessRoutes, { prefix: '/api/access' });

  const { accessPointRoutes } = await import('./routes/access-point.routes.js');
  await app.register(accessPointRoutes, { prefix: '/api/communities' });

  const { guardShiftRoutes } = await import('./routes/guard-shift.routes.js');
  await app.register(guardShiftRoutes, { prefix: '/api/guard' });

  const { bitacoraRoutes } = await import('./routes/bitacora.routes.js');
  await app.register(bitacoraRoutes, { prefix: '/api/bitacora' });

  await startOutboxWorker(app.log);
  app.addHook('onClose', async () => stopOutboxWorker());

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
