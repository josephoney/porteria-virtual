import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { and, eq } from 'drizzle-orm';
import { createDb } from '@porteria/database';
import { communities, organizations } from '@porteria/database/schema';
import * as invitationService from '../services/invitation.service.js';
import { acceptInvitationSchema } from '../schemas/index.js';
import { isRateLimited, rateLimitKey } from '../lib/rate-limit.js';

const db = createDb();

function invitationErrorStatus(code: string): number {
  switch (code) {
    case 'not_found':
      return 404;
    case 'gone':
      return 410;
    case 'login_required':
      return 409;
    case 'email_mismatch':
      return 403;
    case 'forbidden':
      return 403;
    case 'conflict':
      return 409;
    default:
      return 400;
  }
}

export async function publicRoutes(app: FastifyInstance) {
  app.get('/communities/:slug', async (request: FastifyRequest, reply: FastifyReply) => {
    if (isRateLimited(rateLimitKey('public-community', request), 60, 60_000)) {
      return reply.status(429).send({ error: 'Too many requests' });
    }

    const { slug } = request.params as { slug: string };

    const [row] = await db
      .select({
        id: communities.id,
        name: communities.name,
        slug: communities.slug,
        address: communities.address,
        timezone: communities.timezone,
        organizationId: organizations.id,
        organizationName: organizations.name,
        organizationSlug: organizations.slug,
      })
      .from(communities)
      .innerJoin(organizations, eq(communities.organizationId, organizations.id))
      .where(and(eq(communities.slug, slug), eq(communities.status, 'active')))
      .limit(1);

    if (!row) {
      return reply.status(404).send({ error: 'Community not found' });
    }

    reply.header('Cache-Control', 'public, max-age=30');
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      address: row.address,
      timezone: row.timezone,
      organization: {
        id: row.organizationId,
        name: row.organizationName,
        slug: row.organizationSlug,
      },
    };
  });

  app.get('/invitations/:token', async (request: FastifyRequest, reply: FastifyReply) => {
    if (isRateLimited(rateLimitKey('public-invitation-preview', request), 60, 60_000)) {
      return reply.status(429).send({ error: 'Too many requests' });
    }

    const { token } = request.params as { token: string };
    const result = await invitationService.previewInvitation(token);

    if (!result.ok) {
      const status = invitationErrorStatus(result.code);
      return reply.status(status).send({ error: 'Invalid invitation' });
    }

    return result.data;
  });

  app.post(
    '/invitations/:token/accept',
    async (request: FastifyRequest, reply: FastifyReply) => {
      if (isRateLimited(rateLimitKey('public-invitation-accept', request), 20, 60_000)) {
        return reply.status(429).send({ error: 'Too many requests' });
      }

      let authenticatedUserId: string | undefined;
      if (request.headers.authorization) {
        try {
          await request.jwtVerify();
          authenticatedUserId = request.user.sub;
        } catch {
          return reply.status(401).send({ error: 'Invalid session' });
        }
      }

      const { token } = request.params as { token: string };
      const body = acceptInvitationSchema.parse(request.body);
      const result = await invitationService.acceptInvitation(
        token,
        body,
        authenticatedUserId,
      );

      if (!result.ok) {
        const status = invitationErrorStatus(result.code);
        return reply.status(status).send({
          error:
            result.code === 'login_required'
              ? 'Account already exists, log in first'
              : result.code === 'email_mismatch'
                ? 'Invitation email does not match the session'
                : 'Invitation could not be accepted',
        });
      }

      return reply.status(200).send(result.data);
    },
  );
}
