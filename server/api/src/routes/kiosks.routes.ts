import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { and, eq } from 'drizzle-orm';
import crypto from 'crypto';
import { createDb } from '@porteria/database';
import { kiosks, communities } from '@porteria/database/schema';
import { requireRole } from '../middlewares/rbac.js';
import * as kiosksService from '../services/kiosks.service.js';
import * as callsService from '../services/calls.service.js';
import * as eventsService from '../services/events.service.js';
import { kiosksQuerySchema } from '../schemas/index.js';
import config from '../config.js';

const db = createDb();

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

export async function kiosksRoutes(app: FastifyInstance) {
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
      const query = kiosksQuerySchema.parse(request.query);
      return kiosksService.listKiosks(u.orgId, {
        status: query.status,
        communityId: effectiveCommunityId(u, query.communityId),
      });
    },
  );

  app.post(
    '/:id/device-token',
    { preHandler: [requireRole('org_admin', 'community_admin')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const u = getUser(request);
      const { id } = request.params as { id: string };

      const [kiosk] = await db
        .select({
          id: kiosks.id,
          communityId: kiosks.communityId,
          organizationId: communities.organizationId,
        })
        .from(kiosks)
        .innerJoin(communities, eq(kiosks.communityId, communities.id))
        .where(eq(kiosks.id, id))
        .limit(1);

      if (!kiosk) {
        return reply.status(404).send({ error: 'Kiosk not found' });
      }
      if (u.role === 'community_admin' && kiosk.communityId !== u.communityId) {
        return reply.status(403).send({ error: 'Kiosk out of scope' });
      }
      if (u.role === 'org_admin' && kiosk.organizationId !== u.orgId) {
        return reply.status(404).send({ error: 'Kiosk not found' });
      }

      const deviceToken = crypto.randomBytes(32).toString('hex');
      const deviceTokenHash = crypto.createHash('sha256').update(deviceToken).digest('hex');
      const rotatedAt = new Date();

      await db
        .update(kiosks)
        .set({ deviceTokenHash, deviceTokenRotatedAt: rotatedAt })
        .where(eq(kiosks.id, id));

      return { deviceToken, rotatedAt: rotatedAt.toISOString() };
    },
  );
}

export async function internalKioskRoutes(app: FastifyInstance) {
  app.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    const key = request.headers['x-internal-key'];
    if (key !== config.internalApiKey) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }
  });

  app.get('/resolve', async (request: FastifyRequest, reply: FastifyReply) => {
    const { rpiId, communityId } = request.query as {
      rpiId?: string;
      communityId?: string;
    };
    if (!rpiId) {
      return reply.status(400).send({ error: 'rpiId is required' });
    }

    const conditions = [eq(kiosks.rpiId, rpiId)];
    if (communityId) conditions.push(eq(kiosks.communityId, communityId));

    const rows = await db
      .select({
        kioskId: kiosks.id,
        rpiId: kiosks.rpiId,
        name: kiosks.name,
        communityId: kiosks.communityId,
        organizationId: communities.organizationId,
      })
      .from(kiosks)
      .innerJoin(communities, eq(kiosks.communityId, communities.id))
      .where(and(...conditions))
      .limit(2);

    if (rows.length === 0) {
      return reply.status(404).send({ error: 'Kiosk not found' });
    }
    if (rows.length > 1) {
      return reply.status(409).send({ error: 'Ambiguous rpiId; provide communityId' });
    }

    return rows[0];
  });
}

export async function dashboardRoutes(app: FastifyInstance) {
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
    '/stats',
    { preHandler: [requireRole('org_admin', 'community_admin', 'operator')] },
    async (request: FastifyRequest) => {
      const u = getUser(request);
      const query = request.query as { from?: string; to?: string; communityId?: string };
      const communityId = effectiveCommunityId(u, query.communityId);

      const [totalKiosks, callsToday, eventsToday, activeCalls] = await Promise.all([
        kiosksService.getKiosksCount(u.orgId, communityId),
        callsService.getCallsTodayCount(u.orgId, query.from, query.to, communityId),
        eventsService.getEventsTodayCount(u.orgId, query.from, query.to, communityId),
        callsService.getActiveCallsCount(u.orgId, communityId),
      ]);

      return { totalKiosks, callsToday, eventsToday, activeCalls, communityId };
    },
  );
}
