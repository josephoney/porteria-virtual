import type { FastifyInstance, FastifyReply } from 'fastify';
import config from '../config.js';
import { readPassDeviceCookie, serializePassDeviceCookie } from '../lib/device-cookie.js';
import { sendPassError } from '../lib/pass-error-status.js';
import { signDeviceKey } from '../lib/pass-tokens.js';
import { isRateLimited, rateLimitKey } from '../lib/rate-limit.js';
import { bindPassSchema } from '../schemas/index.js';
import * as publicPassService from '../services/public-pass.service.js';

function isLimited(
  request: { ip?: string; url?: string },
  reply: FastifyReply,
  prefix: string,
  limit: number,
): boolean {
  if (!isRateLimited(rateLimitKey(prefix, request), limit, 60_000)) return false;

  reply.status(429).send({
    statusCode: 429,
    error: 'Too Many Requests',
    message: 'rate_limited',
  });
  return true;
}

export async function publicPassRoutes(app: FastifyInstance) {
  app.get('/:token', async (request, reply) => {
    if (isLimited(request, reply, 'pass-preview', config.passes.rateLimits.previewPerMinute))
      return;
    const { token } = request.params as { token: string };
    const result = await publicPassService.previewPass(token, readPassDeviceCookie(request));
    if (!result.ok) return sendPassError(reply, result.code);
    return reply.send(result.data);
  });

  app.post('/:token/bind', async (request, reply) => {
    if (isLimited(request, reply, 'pass-bind', config.passes.rateLimits.bindPerMinute)) return;
    const { token } = request.params as { token: string };
    const body = bindPassSchema.parse(request.body ?? {});
    const result = await publicPassService.bindPass(token, body, readPassDeviceCookie(request));
    if (!result.ok) return sendPassError(reply, result.code);

    if (result.data.deviceKey) {
      const cookieValue = `${result.data.passId}.${result.data.deviceKey}.${signDeviceKey(
        result.data.passId,
        result.data.deviceKey,
        config.passes.qrSecret,
      )}`;
      const maxAge = Math.max(
        0,
        Math.floor((result.data.linkExpiresAt.getTime() - Date.now()) / 1000),
      );
      reply.header(
        'Set-Cookie',
        serializePassDeviceCookie(cookieValue, maxAge, request.protocol === 'https'),
      );
    }

    return reply.send({
      passId: result.data.passId,
      alreadyBound: !result.data.deviceKey,
    });
  });

  app.get('/:token/qr', async (request, reply) => {
    if (isLimited(request, reply, 'pass-qr', config.passes.rateLimits.qrPerMinute)) return;
    const { token } = request.params as { token: string };
    const result = await publicPassService.getPublicQr(token, readPassDeviceCookie(request));
    if (!result.ok) return sendPassError(reply, result.code);
    return reply.send(result.data);
  });

  app.get('/:token/status', async (request, reply) => {
    if (isLimited(request, reply, 'pass-status', config.passes.rateLimits.statusPerMinute)) return;
    const { token } = request.params as { token: string };
    const result = await publicPassService.getPublicStatus(token, readPassDeviceCookie(request));
    if (!result.ok) return sendPassError(reply, result.code);
    return reply.send(result.data);
  });
}
