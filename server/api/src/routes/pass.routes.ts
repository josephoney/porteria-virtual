import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import config from '../config.js';
import { sendPassError } from '../lib/pass-error-status.js';
import { requireRole } from '../middlewares/rbac.js';
import { createPassBatchSchema, createPassSchema, passesQuerySchema } from '../schemas/index.js';
import * as passService from '../services/pass.service.js';

function getRequester(request: FastifyRequest): passService.PassRequester {
  const user = request.user as {
    sub: string;
    personId?: string;
    role: string;
    orgId: string;
    communityId: string | null;
    membershipId: string;
    isPlatformAdmin: boolean;
  };

  return {
    sub: user.sub,
    personId: user.personId,
    role: user.role,
    orgId: user.orgId,
    communityId: user.communityId ?? null,
    membershipId: user.membershipId,
    isPlatformAdmin: Boolean(user.isPlatformAdmin),
  };
}

async function dynamicQrGuard(_request: FastifyRequest, reply: FastifyReply) {
  if (!config.features.dynamicQrEnabled) {
    return reply.status(404).send({
      statusCode: 404,
      error: 'Not Found',
      message: 'Dynamic QR is disabled',
    });
  }
}

export async function passRoutes(app: FastifyInstance) {
  app.addHook('onRequest', async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch (err) {
      const code = (err as { code?: string }).code;
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: code === 'FAST_JWT_EXPIRED' ? 'Token expired' : 'Invalid token',
      });
    }
  });

  app.post(
    '/',
    { preHandler: [dynamicQrGuard, requireRole('owner', 'tenant', 'resident')] },
    async (request, reply) => {
      const body = createPassSchema.parse(request.body);
      const result = await passService.createPass(getRequester(request), body);
      if (!result.ok) return sendPassError(reply, result.code);
      return reply.status(201).send(result.data);
    },
  );

  app.get(
    '/destinations',
    { preHandler: [dynamicQrGuard, requireRole('owner', 'tenant', 'resident')] },
    async (request, reply) => {
      const result = await passService.listDestinations(getRequester(request));
      if (!result.ok) return sendPassError(reply, result.code);
      return reply.send(result.data);
    },
  );

  app.post(
    '/batch',
    { preHandler: [dynamicQrGuard, requireRole('owner', 'tenant', 'resident')] },
    async (request, reply) => {
      const parsed = createPassBatchSchema.safeParse(request.body);
      if (!parsed.success) {
        const tooBig = parsed.error.issues.some((issue) => issue.code === 'too_big');
        if (tooBig) {
          return reply.status(400).send({
            statusCode: 400,
            error: 'Pass rejected',
            message: 'batch_too_large',
            max: passService.PASS_BATCH_MAX_VISITORS,
          });
        }
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: parsed.error.issues[0]?.message ?? 'invalid_batch',
        });
      }

      const result = await passService.createPassBatch(getRequester(request), parsed.data);
      if (!result.ok) return sendPassError(reply, result.code);
      return reply.status(201).send(result.data);
    },
  );

  app.get(
    '/',
    { preHandler: [dynamicQrGuard, requireRole('owner', 'tenant', 'resident')] },
    async (request, reply) => {
      const query = passesQuerySchema.parse(request.query);
      const result = await passService.listPasses(getRequester(request), query);
      if (!result.ok) return sendPassError(reply, result.code);
      // The mobile client expects a plain array; the total travels in a header.
      return reply.header('X-Total-Count', String(result.data.total)).send(result.data.items);
    },
  );

  app.get(
    '/history-destinations',
    { preHandler: [dynamicQrGuard, requireRole('owner', 'tenant', 'resident')] },
    async (request, reply) => {
      const result = await passService.listHistoryDestinations(getRequester(request));
      if (!result.ok) return sendPassError(reply, result.code);
      return reply.send(result.data);
    },
  );

  app.get(
    '/:id',
    { preHandler: [dynamicQrGuard, requireRole('owner', 'tenant', 'resident')] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const result = await passService.getPassById(getRequester(request), id);
      if (!result.ok) return sendPassError(reply, result.code);
      return reply.send(result.data);
    },
  );

  app.post(
    '/:id/revoke',
    { preHandler: [dynamicQrGuard, requireRole('owner', 'tenant', 'resident')] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const result = await passService.revokePass(getRequester(request), id);
      if (!result.ok) return sendPassError(reply, result.code);
      return reply.send(result.data);
    },
  );

  app.post(
    '/:id/regenerate-link',
    { preHandler: [dynamicQrGuard, requireRole('owner', 'tenant', 'resident')] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const result = await passService.regenerateLink(getRequester(request), id);
      if (!result.ok) return sendPassError(reply, result.code);
      return reply.send(result.data);
    },
  );

  app.get(
    '/:id/qr',
    { preHandler: [dynamicQrGuard, requireRole('owner', 'tenant', 'resident')] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const result = await passService.getResidentQr(getRequester(request), id);
      if (!result.ok) return sendPassError(reply, result.code);
      return reply.send(result.data);
    },
  );
}
