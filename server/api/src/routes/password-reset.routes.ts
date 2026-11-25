import bcrypt from 'bcryptjs';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import { isRateLimited, rateLimitKey } from '../lib/rate-limit.js';
import {
  requestPasswordReset,
  resetPassword,
  RESET_TOKEN_MINUTES,
} from '../services/password-reset.service.js';

/** Mismo mÃ­nimo que el resto de las contraseÃ±as del sistema. */
const MIN_PASSWORD_LENGTH = 8;

function tooManyRequests(reply: FastifyReply) {
  return reply.status(429).send({
    statusCode: 429,
    error: 'Too Many Requests',
    message: 'rate_limited',
  });
}

/**
 * RecuperaciÃ³n de contraseÃ±a.
 *
 * Las dos rutas son pÃºblicas a propÃ³sito: quien olvidÃ³ su contraseÃ±a no puede
 * autenticarse para pedir ayuda.
 */
export async function passwordResetRoutes(app: FastifyInstance) {
  app.post('/password/forgot', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = (request.body ?? {}) as { email?: unknown };
    const email = typeof body.email === 'string' ? body.email.trim() : '';

    if (!email || !email.includes('@')) {
      return reply
        .status(400)
        .send({ statusCode: 400, error: 'Bad Request', message: 'Correo invÃ¡lido' });
    }

    // Dos lÃ­mites: uno por quien pide y otro por la cuenta objetivo, para que un
    // atacante no llene de correos el buzÃ³n de una persona.
    if (
      isRateLimited(rateLimitKey('reset-ip', request), 5, 60_000) ||
      isRateLimited(`reset-email:${email.toLowerCase()}`, 3, 60_000)
    ) {
      return tooManyRequests(reply);
    }

    const result = await requestPasswordReset(email, request.ip ?? null);
    if (!result.ok) return reply.status(400).send({ statusCode: 400, message: result.code });

    // La respuesta es la misma exista o no la cuenta: el formulario no puede
    // servir para averiguar quÃ© correos estÃ¡n registrados.
    return reply.status(202).send({ status: 'ok', expiresInMinutes: RESET_TOKEN_MINUTES });
  });

  app.post('/password/reset', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = (request.body ?? {}) as { token?: unknown; password?: unknown };
    const token = typeof body.token === 'string' ? body.token.trim() : '';
    const password = typeof body.password === 'string' ? body.password : '';

    if (isRateLimited(rateLimitKey('reset-consume', request), 10, 60_000)) {
      return tooManyRequests(reply);
    }
    if (!token) {
      return reply
        .status(400)
        .send({ statusCode: 400, error: 'Bad Request', message: 'invalid_token' });
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'La contraseÃ±a debe tener al menos ocho caracteres',
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const result = await resetPassword(token, passwordHash);
    if (!result.ok) {
      const message =
        result.code === 'expired_token'
          ? 'El enlace venciÃ³; pide uno nuevo'
          : 'El enlace no es vÃ¡lido o ya se usÃ³';
      return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message });
    }

    return reply.send({ status: 'ok' });
  });
}
