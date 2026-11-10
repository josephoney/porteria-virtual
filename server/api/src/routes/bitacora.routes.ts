import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type {
  BitacoraEntryType,
  CreateBitacoraCommentDto,
  CreateBitacoraEntryDto,
} from '@porteria/shared';
import { requireRole } from '../middlewares/rbac.js';
import {
  bitacoraQuerySchema,
  createBitacoraCommentSchema,
  createBitacoraEntrySchema,
} from '../schemas/index.js';
import {
  addComment,
  createManualEntry,
  getBitacoraEntry,
  listBitacora,
  type BitacoraQuery,
  type BitacoraRequester,
  type BitacoraResult,
} from '../services/bitacora.service.js';

function getRequester(request: FastifyRequest): BitacoraRequester {
  const user = request.user;
  return {
    sub: user.sub,
    personId: user.personId,
    accountId: user.accountId,
    role: user.role,
    orgId: user.orgId,
    communityId: user.communityId ?? null,
    membershipId: user.membershipId,
    isPlatformAdmin: Boolean(user.isPlatformAdmin),
  };
}

function sendError<T>(reply: FastifyReply, result: Extract<BitacoraResult<T>, { ok: false }>) {
  const status = result.code === 'not_found' ? 404 : result.code === 'forbidden' ? 403 : 400;
  const error = status === 404 ? 'Not Found' : status === 403 ? 'Forbidden' : 'Bad Request';
  return reply.status(status).send({ statusCode: status, error, message: result.code });
}

export async function bitacoraRoutes(app: FastifyInstance) {
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

  app.get(
    '/',
    { preHandler: [requireRole('guard', 'community_admin', 'org_admin')] },
    async (request, reply) => {
      const parsed = bitacoraQuerySchema.parse(request.query);
      const query: BitacoraQuery = {
        communityId: parsed.communityId,
        accessPointId: parsed.accessPointId,
        shiftId: parsed.shiftId,
        type: parsed.type as BitacoraEntryType | undefined,
        from: parsed.from,
        to: parsed.to,
        page: parsed.page,
        pageSize: parsed.pageSize,
      };
      const result = await listBitacora(getRequester(request), query);
      if (!result.ok) return sendError(reply, result);
      return reply.send(result.data);
    },
  );

  app.get(
    '/:id',
    { preHandler: [requireRole('guard', 'community_admin', 'org_admin')] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const result = await getBitacoraEntry(getRequester(request), id);
      if (!result.ok) return sendError(reply, result);
      return reply.send(result.data);
    },
  );

  app.post(
    '/',
    { preHandler: [requireRole('guard', 'community_admin', 'org_admin')] },
    async (request, reply) => {
      const body = createBitacoraEntrySchema.parse(request.body) as CreateBitacoraEntryDto;
      const result = await createManualEntry(getRequester(request), body);
      if (!result.ok) return sendError(reply, result);
      return reply.status(201).send(result.data);
    },
  );

  app.post(
    '/:id/comments',
    { preHandler: [requireRole('guard', 'community_admin', 'org_admin')] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = createBitacoraCommentSchema.parse(request.body) as CreateBitacoraCommentDto;
      const result = await addComment(getRequester(request), id, body);
      if (!result.ok) return sendError(reply, result);
      return reply.status(201).send(result.data);
    },
  );
}
