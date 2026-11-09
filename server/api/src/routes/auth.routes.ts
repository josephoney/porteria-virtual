import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import * as authService from '../services/auth.service.js';
import * as eventsService from '../services/events.service.js';
import { loginSchema, refreshSchema, contextSwitchSchema } from '../schemas/index.js';

export async function authRoutes(app: FastifyInstance) {
  app.post('/login', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = loginSchema.parse(request.body);

    if (body.communitySlug) {
      const outcome = await authService.loginScoped(
        body.email,
        body.password,
        body.communitySlug,
      );

      if (!outcome.ok) {
        const status =
          outcome.reason === 'community_not_found'
            ? 404
            : outcome.reason === 'no_community_access'
              ? 403
              : 401;
        return reply.status(status).send({
          statusCode: status,
          error:
            status === 404 ? 'Not Found' : status === 403 ? 'Forbidden' : 'Unauthorized',
          message:
            outcome.reason === 'community_not_found'
              ? 'Community not found'
              : outcome.reason === 'no_community_access'
                ? 'No access to this community'
                : 'Invalid email or password',
        });
      }

      if ('accessToken' in outcome.result) {
        eventsService
          .insertEvent({
            eventType: 'user.login',
            actorId: outcome.result.user.id,
            actorRole: outcome.result.activeMembership.role,
            organizationId: outcome.result.activeMembership.organizationId,
            communityId: outcome.result.activeMembership.communityId,
          })
          .catch(() => {});
      }

      return reply.status(200).send(outcome.result);
    }

    const result = await authService.login(body.email, body.password);

    if (!result) {
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Invalid email or password',
      });
    }

    if ('accessToken' in result) {
      eventsService
        .insertEvent({
          eventType: 'user.login',
          actorId: result.user.id,
          actorRole: result.activeMembership.role,
          organizationId: result.activeMembership.organizationId,
          communityId: result.activeMembership.communityId,
        })
        .catch(() => {});
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

  app.post('/context', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
    } catch {
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Invalid token',
      });
    }

    const body = contextSwitchSchema.parse(request.body);
    const payload = request.user as { sub?: string; membershipId?: string; purpose?: string };
    if (!payload.sub) {
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Invalid context token',
      });
    }
    const result = await authService.switchContext(
      payload.sub,
      body.membershipId,
      body.refreshToken,
    );

    if (!result) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: 'Membership not found or inactive',
      });
    }

    return reply.status(200).send(result);
  });

  app.post('/logout', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = refreshSchema.parse(request.body);
    const userInfo = await authService.getUserByRefreshToken(body.refreshToken);
    await authService.logout(body.refreshToken);

    if (userInfo) {
      eventsService
        .insertEvent({
          eventType: 'user.logout',
          actorId: userInfo.userId,
          actorRole: userInfo.role,
          organizationId: userInfo.organizationId,
          communityId: null,
        })
        .catch(() => {});
    }

    return reply.status(200).send({ message: 'Logged out' });
  });
}
