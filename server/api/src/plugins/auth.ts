import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq } from 'drizzle-orm';
import { createDb } from '@porteria/database';
import { memberships } from '@porteria/database/schema';

export interface JwtPayload {
  sub: string;
  accountId?: string;
  personId?: string;
  email: string;
  orgId: string;
  membershipId: string;
  role: string;
  communityId: string | null;
  unitId: string | null;
  isPlatformAdmin: boolean;
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: JwtPayload;
    user: JwtPayload;
  }
}

const SKIP_PREFIXES = ['/health', '/api/auth/', '/api/internal/', '/api/public/'];

export function registerMembershipGuard(app: FastifyInstance) {
  const db = createDb();

  app.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    const path = request.url.split('?')[0];
    if (SKIP_PREFIXES.some((prefix) => path === prefix || path.startsWith(prefix))) {
      return;
    }

    // Route-level hooks still return 401 when the header is missing.
    if (!request.headers.authorization) return;

    try {
      await request.jwtVerify();
    } catch (err) {
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: (err as { code?: string }).code === 'FAST_JWT_EXPIRED' ? 'Token expired' : 'Invalid token',
      });
    }

    const payload = request.user;

    if (!payload.accountId || !payload.personId) {
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Legacy token rejected; sign in again',
      });
    }

    if (payload.membershipId === 'platform') {
      if (!payload.isPlatformAdmin) {
        return reply.status(401).send({
          statusCode: 401,
          error: 'Unauthorized',
          message: 'Invalid platform context',
        });
      }

      const tenantAllowed =
        path === '/api/me' ||
        path.startsWith('/api/me/') ||
        path.startsWith('/api/invitations') ||
        path.startsWith('/api/sections') ||
        path.startsWith('/api/units') ||
        path.startsWith('/api/reports') ||
        path.startsWith('/api/location-structures') ||
        path.startsWith('/api/location-units') ||
        path.startsWith('/api/communities/') ||
        path.startsWith('/api/platform/');

      if (!tenantAllowed) {
        return reply.status(403).send({
          statusCode: 403,
          error: 'Forbidden',
          message: 'Seleccioná una comunidad para acceder a este recurso',
        });
      }

      return;
    }

    const [membership] = await db
      .select()
      .from(memberships)
      .where(eq(memberships.id, payload.membershipId))
      .limit(1);

    if (!membership || membership.status !== 'active' || membership.userId !== payload.sub) {
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Membership inactive or invalid',
      });
    }
  });
}
