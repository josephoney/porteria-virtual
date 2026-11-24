import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import config from '../config.js';
import { sendPassError } from '../lib/pass-error-status.js';
import { onPassEvent } from '../lib/pass-bus.js';
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

/**
 * Emergency switch: `DYNAMIC_QR_ENABLED=false` turns the feature off for every
 * community at once. The rule of each community is applied by the service, which
 * is the only place that knows which community the request belongs to.
 */
async function dynamicQrGuard(_request: FastifyRequest, reply: FastifyReply) {
  if (!config.features.dynamicQrEnabled) {
    return reply.status(404).send({
      statusCode: 404,
      error: 'Not Found',
      message: 'Dynamic QR is disabled',
    });
  }
}

type BatchBody = Parameters<typeof passService.createPassBatch>[1];

/** Parses a batch body, replying with 400 when the payload cannot be used. */
function parseBatchBody(request: FastifyRequest, reply: FastifyReply): BatchBody | null {
  const parsed = createPassBatchSchema.safeParse(request.body);
  if (parsed.success) return parsed.data;

  const tooBig = parsed.error.issues.some(
    (issue) => issue.code === 'too_big' && issue.path.length === 1 && issue.path[0] === 'visitors',
  );
  if (tooBig) {
    reply.status(400).send({
      statusCode: 400,
      error: 'Pass rejected',
      message: 'batch_too_large',
      max: passService.PASS_BATCH_MAX_VISITORS,
    });
    return null;
  }

  reply.status(400).send({
    statusCode: 400,
    error: 'Bad Request',
    message: parsed.error.issues[0]?.message ?? 'invalid_batch',
  });
  return null;
}

/**
 * `reply.hijack()` writes the socket by hand, so Fastify never gets a chance to
 * add the CORS headers. Without them the browser drops an otherwise valid
 * stream, so they are emitted here for the allowed origins only.
 */
function streamCorsHeaders(origin?: string): Record<string, string> {
  if (!origin || !config.corsOrigins.includes(origin)) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': 'true',
    Vary: 'Origin',
  };
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
      if (!result.ok) {
        // The limit rejection carries the community maximum so the client can say
        // "you reached your 50 of today" instead of a bare code.
        return sendPassError(
          reply,
          result.code,
          'Pass rejected',
          result.max === undefined ? {} : { max: result.max },
        );
      }
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
    '/batch/preview',
    { preHandler: [dynamicQrGuard, requireRole('owner', 'tenant', 'resident')] },
    async (request, reply) => {
      const body = parseBatchBody(request, reply);
      if (!body) return;

      const result = await passService.previewPassBatch(getRequester(request), body);
      if (!result.ok) return sendPassError(reply, result.code);
      return reply.send(result.data);
    },
  );

  app.post(
    '/batch',
    { preHandler: [dynamicQrGuard, requireRole('owner', 'tenant', 'resident')] },
    async (request, reply) => {
      const body = parseBatchBody(request, reply);
      if (!body) return;

      const result = await passService.createPassBatch(getRequester(request), body);
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
    '/stream',
    { preHandler: [dynamicQrGuard, requireRole('owner', 'tenant', 'resident')] },
    async (request, reply) => {
      const requester = getRequester(request);
      const personId = await passService.personIdForRequester(requester);
      if (!personId) return sendPassError(reply, 'forbidden');

      // Take the socket: Fastify must not serialize a response that stays open.
      reply.hijack();
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
        ...streamCorsHeaders(request.headers.origin),
      });
      reply.raw.write(': connected\n\n');

      // The person comes from the session, never from the query: filtering by a
      // client supplied id would let one resident watch another's passes.
      const unsubscribe = onPassEvent((event) => {
        if (event.personId !== personId) return;
        reply.raw.write(`event: pass\ndata: ${JSON.stringify(event)}\n\n`);
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
