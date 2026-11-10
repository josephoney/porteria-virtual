import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { ScanAction, ScanStatus } from '@porteria/shared';
import config from '../config.js';
import { sendPassError } from '../lib/pass-error-status.js';
import { requireRole } from '../middlewares/rbac.js';
import { scanDecisionSchema, scanPassSchema, scansQuerySchema } from '../schemas/index.js';
import { confirmScan, listScans, rejectScan, scanPass } from '../services/access-scan.service.js';
import type { PassRequester } from '../services/pass.service.js';

function getRequester(request: FastifyRequest): PassRequester {
  const user = request.user;
  return {
    sub: user.sub,
    accountId: user.accountId,
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
    return reply
      .status(404)
      .send({ statusCode: 404, error: 'Not Found', message: 'dynamic_qr_disabled' });
  }
}

export async function accessRoutes(app: FastifyInstance) {
  app.addHook('onRequest', async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch (error) {
      const code = (error as { code?: string }).code;
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: code === 'FAST_JWT_EXPIRED' ? 'Token expired' : 'Invalid token',
      });
    }
  });

  app.post(
    '/scan',
    { preHandler: [dynamicQrGuard, requireRole('guard')] },
    async (request, reply) => {
      const body = scanPassSchema.parse(request.body);
      const result = await scanPass(getRequester(request), body.token);
      if (!result.ok) return sendPassError(reply, result.code);
      return reply.send(result.data);
    },
  );

  app.post(
    '/scans/:id/confirm',
    { preHandler: [dynamicQrGuard, requireRole('guard')] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const result = await confirmScan(getRequester(request), id);
      if (!result.ok) return sendPassError(reply, result.code);
      return reply.send(result.data);
    },
  );

  app.post(
    '/scans/:id/reject',
    { preHandler: [dynamicQrGuard, requireRole('guard')] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = scanDecisionSchema.parse(request.body ?? {});
      const result = await rejectScan(getRequester(request), id, body.reason);
      if (!result.ok) return sendPassError(reply, result.code);
      return reply.send(result.data);
    },
  );

  app.get(
    '/scans',
    { preHandler: [dynamicQrGuard, requireRole('guard')] },
    async (request, reply) => {
      const query = scansQuerySchema.parse(request.query) as {
        page: number;
        pageSize: number;
        status?: ScanStatus;
        action?: ScanAction;
      };
      const result = await listScans(getRequester(request), query);
      if (!result.ok) return sendPassError(reply, result.code);
      return reply.send(result.data);
    },
  );
}
