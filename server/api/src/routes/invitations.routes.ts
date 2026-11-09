import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { requireRole } from '../middlewares/rbac.js';
import * as invitationService from '../services/invitation.service.js';
import * as eventsService from '../services/events.service.js';
import { createInvitationSchema } from '../schemas/index.js';
import type { MembershipRole } from '@porteria/shared';

function getRequester(request: FastifyRequest): invitationService.InvitationRequester {
  const u = request.user;
  return {
    sub: u.sub,
    role: u.role,
    orgId: u.orgId,
    communityId: u.communityId ?? null,
    isPlatformAdmin: Boolean(u.isPlatformAdmin),
  };
}

function errorStatus(code: string): number {
  switch (code) {
    case 'not_found':
      return 404;
    case 'forbidden':
      return 403;
    case 'conflict':
      return 409;
    case 'gone':
      return 410;
    default:
      return 400;
  }
}

function audit(
  eventType: string,
  invitation: { id: string; organizationId: string; communityId: string | null; role: string; email: string },
  requester: invitationService.InvitationRequester,
) {
  eventsService
    .insertEvent({
      eventType,
      actorId: requester.sub,
      actorRole: requester.role,
      organizationId: invitation.organizationId,
      communityId: invitation.communityId,
      metadata: {
        invitationId: invitation.id,
        role: invitation.role,
        email: invitation.email,
      },
    })
    .catch(() => {});
}

export async function invitationRoutes(app: FastifyInstance) {
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

  app.post(
    '/',
    { preHandler: [requireRole('org_admin', 'community_admin')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const requester = getRequester(request);
      const body = createInvitationSchema.parse(request.body);
      const result = await invitationService.createInvitation({ ...body, role: body.role as MembershipRole }, requester);

      if (!result.ok) {
        return reply.status(errorStatus(result.code)).send({
          statusCode: errorStatus(result.code),
          error: 'Invitation rejected',
          message: result.code,
        });
      }

      audit('invitation.created', result.data.invitation, requester);
      return reply.status(201).send(result.data);
    },
  );

  app.get(
    '/',
    { preHandler: [requireRole('org_admin', 'community_admin')] },
    async (request: FastifyRequest) => {
      const requester = getRequester(request);
      const query = request.query as { status?: string; communityId?: string };
      return invitationService.listInvitations(requester, query);
    },
  );

  app.post(
    '/:id/revoke',
    { preHandler: [requireRole('org_admin', 'community_admin')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const requester = getRequester(request);
      const { id } = request.params as { id: string };
      const result = await invitationService.revokeInvitation(id, requester);

      if (!result.ok) {
        return reply.status(errorStatus(result.code)).send({
          statusCode: errorStatus(result.code),
          error: 'Invitation rejected',
          message: result.code,
        });
      }

      audit('invitation.revoked', result.data, requester);
      return result.data;
    },
  );

  app.post(
    '/:id/resend',
    { preHandler: [requireRole('org_admin', 'community_admin')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const requester = getRequester(request);
      const { id } = request.params as { id: string };
      const result = await invitationService.resendInvitation(id, requester);

      if (!result.ok) {
        return reply.status(errorStatus(result.code)).send({
          statusCode: errorStatus(result.code),
          error: 'Invitation rejected',
          message: result.code,
        });
      }

      audit('invitation.resent', result.data.invitation, requester);
      return result.data;
    },
  );
}
