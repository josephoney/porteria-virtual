import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import config from '../config.js';
import {
  passDeviceCookieName,
  readPassDeviceBindings,
  readPassLinkBindings,
  serializePassDeviceCookie,
  serializePassLinkCookie,
} from '../lib/device-cookie.js';
import { sendPassError } from '../lib/pass-error-status.js';
import { signDeviceKey } from '../lib/pass-tokens.js';
import { isRateLimited, rateLimitKey } from '../lib/rate-limit.js';
import { bindPassSchema } from '../schemas/index.js';
import type { PassGrant } from '../services/pass-errors.js';
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

function cookieSecure(request: FastifyRequest): boolean {
  return config.security.cookieSecure || request.protocol === 'https';
}

function maxAgeSeconds(expiresAt: Date): number {
  return Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
}

/**
 * Moves a device off the legacy single-pass cookie: when that is the binding
 * the request proved, the same signed value is written under the pass name.
 */
function writeLegacyReissue(
  request: FastifyRequest,
  reply: FastifyReply,
  grant: PassGrant | undefined,
): void {
  if (!grant?.legacyCookie) return;
  reply.header(
    'Set-Cookie',
    serializePassDeviceCookie(
      grant.legacyCookie,
      maxAgeSeconds(grant.linkExpiresAt),
      cookieSecure(request),
      passDeviceCookieName(grant.passId),
    ),
  );
}

/**
 * Remembers the link token of an authorized pass, so the device can return to
 * it later. The token never goes into the device cookie: the signature scheme
 * stays untouched.
 */
function writePassCookies(
  request: FastifyRequest,
  reply: FastifyReply,
  grant: PassGrant | undefined,
  token: string,
): void {
  if (!grant) return;
  reply.header(
    'Set-Cookie',
    serializePassLinkCookie(
      token,
      maxAgeSeconds(grant.linkExpiresAt),
      cookieSecure(request),
      grant.passId,
    ),
  );
  writeLegacyReissue(request, reply, grant);
}

export async function publicPassRoutes(app: FastifyInstance) {
  app.get('/', async (request, reply) => {
    if (isLimited(request, reply, 'pass-index', config.passes.rateLimits.indexPerMinute)) return;

    const result = await publicPassService.listDevicePasses(
      readPassLinkBindings(request),
      readPassDeviceBindings(request),
    );
    if (!result.ok) return sendPassError(reply, result.code);

    for (const grant of result.data.reissues) {
      writeLegacyReissue(request, reply, grant);
    }

    return reply.send({ passes: result.data.passes });
  });

  app.get('/:token', async (request, reply) => {
    if (isLimited(request, reply, 'pass-preview', config.passes.rateLimits.previewPerMinute))
      return;
    const { token } = request.params as { token: string };
    const result = await publicPassService.previewPass(token, readPassDeviceBindings(request));
    if (!result.ok) return sendPassError(reply, result.code);
    writePassCookies(request, reply, result.grant, token);
    return reply.send(result.data);
  });

  app.post('/:token/bind', async (request, reply) => {
    if (isLimited(request, reply, 'pass-bind', config.passes.rateLimits.bindPerMinute)) return;
    const { token } = request.params as { token: string };
    const body = bindPassSchema.parse(request.body ?? {});
    const result = await publicPassService.bindPass(token, body, readPassDeviceBindings(request));
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
      const secure = cookieSecure(request);
      reply.header(
        'Set-Cookie',
        serializePassDeviceCookie(
          cookieValue,
          maxAge,
          secure,
          passDeviceCookieName(result.data.passId),
        ),
      );
      // Legacy cookie during the transition; remove once all clients hold the
      // pass-scoped binding.
      reply.header('Set-Cookie', serializePassDeviceCookie(cookieValue, maxAge, secure));
    }

    writePassCookies(request, reply, result.grant, token);

    return reply.send({
      passId: result.data.passId,
      alreadyBound: !result.data.deviceKey,
    });
  });

  app.get('/:token/qr', async (request, reply) => {
    if (isLimited(request, reply, 'pass-qr', config.passes.rateLimits.qrPerMinute)) return;
    const { token } = request.params as { token: string };
    const result = await publicPassService.getPublicQr(token, readPassDeviceBindings(request));
    if (!result.ok) return sendPassError(reply, result.code);
    writePassCookies(request, reply, result.grant, token);
    return reply.send(result.data);
  });

  app.get('/:token/status', async (request, reply) => {
    if (isLimited(request, reply, 'pass-status', config.passes.rateLimits.statusPerMinute)) return;
    const { token } = request.params as { token: string };
    const result = await publicPassService.getPublicStatus(token, readPassDeviceBindings(request));
    if (!result.ok) return sendPassError(reply, result.code);
    writePassCookies(request, reply, result.grant, token);
    return reply.send(result.data);
  });
}
