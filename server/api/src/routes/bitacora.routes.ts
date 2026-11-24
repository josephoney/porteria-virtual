import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import config from '../config.js';
import type {
  BitacoraEntryType,
  CreateBitacoraCommentDto,
  CreateBitacoraEntryDto,
} from '@porteria/shared';
import { requireRole } from '../middlewares/rbac.js';
import { onBitacoraEvent } from '../lib/bitacora-bus.js';
import {
  bitacoraGuardsQuerySchema,
  bitacoraQuerySchema,
  createBitacoraCommentSchema,
  createBitacoraEntrySchema,
} from '../schemas/index.js';
import {
  addComment,
  createManualEntry,
  getBitacoraEntry,
  listBitacora,
  listBitacoraGuards,
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

/**
 * `reply.hijack()` writes the socket by hand, so Fastify never adds the CORS
 * headers. Without them the browser drops an otherwise valid stream.
 */
function streamCorsHeaders(origin?: string): Record<string, string> {
  if (!origin || !config.corsOrigins.includes(origin)) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': 'true',
    Vary: 'Origin',
  };
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
    { preHandler: [requireRole('guard', 'operator', 'community_admin', 'org_admin')] },
    async (request, reply) => {
      const parsed = bitacoraQuerySchema.parse(request.query);
      const query: BitacoraQuery = {
        communityId: parsed.communityId,
        accessPointId: parsed.accessPointId,
        shiftId: parsed.shiftId,
        guardId: parsed.guardId,
        type: parsed.type as BitacoraEntryType | undefined,
        result: parsed.result as BitacoraQuery['result'],
        types: parsed.types,
        excludeTypes: parsed.excludeTypes,
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

  /** Guardias del alcance para poblar el filtro por guardia. */
  app.get(
    '/guards',
    { preHandler: [requireRole('guard', 'operator', 'community_admin', 'org_admin')] },
    async (request, reply) => {
      const query = bitacoraGuardsQuerySchema.parse(request.query);
      const result = await listBitacoraGuards(getRequester(request), query.communityId);
      if (!result.ok) return sendError(reply, result);
      return reply.send(result.data);
    },
  );

  /**
   * Server-Sent Events for the boards. The guard app writes the bitacora, so a
   * dashboard that only polls is always behind; this pushes the notice as soon as
   * the row lands. The client keeps a slow polling fallback for when the stream
   * cannot stay open.
   */
  app.get(
    '/stream',
    { preHandler: [requireRole('guard', 'operator', 'community_admin', 'org_admin')] },
    async (request, reply) => {
      const query = request.query as { communityId?: string };
      const requester = getRequester(request);
      const communityId = query.communityId ?? requester.communityId;

      if (!communityId) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'communityId is required',
        });
      }
      if (
        !requester.isPlatformAdmin &&
        requester.communityId &&
        requester.communityId !== communityId
      ) {
        return reply.status(403).send({
          statusCode: 403,
          error: 'Forbidden',
          message: 'forbidden',
        });
      }

      // Take the socket: Fastify must not try to serialize a response that is
      // already open and will be written to by the bus.
      reply.hijack();
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        // Caddy and nginx buffer by default, which defeats the whole point.
        'X-Accel-Buffering': 'no',
        ...streamCorsHeaders(request.headers.origin),
      });
      reply.raw.write(': connected\n\n');

      const unsubscribe = onBitacoraEvent((event) => {
        if (event.communityId !== communityId) return;
        reply.raw.write(`event: entry\ndata: ${JSON.stringify(event)}\n\n`);
      });

      // Proxies drop an idle connection after 30 to 60 seconds.
      const heartbeat = setInterval(() => reply.raw.write(': ping\n\n'), 25_000);

      request.raw.on('close', () => {
        clearInterval(heartbeat);
        unsubscribe();
      });
    },
  );

  app.get(
    '/:id',
    { preHandler: [requireRole('guard', 'operator', 'community_admin', 'org_admin')] },
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
