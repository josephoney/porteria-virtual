import type { FastifyReply } from 'fastify';
import type { PassErrorCode } from '../services/pass-errors.js';

export function passErrorStatus(code: PassErrorCode): number {
  switch (code) {
    case 'not_found':
      return 404;
    case 'forbidden':
      return 403;
    case 'conflict':
      return 409;
    case 'gone':
      return 410;
    case 'link_expired':
      return 410;
    case 'pass_used':
      return 410;
    case 'not_bound':
      return 403;
    case 'device_already_bound':
      return 403;
    case 'invalid_pin':
      return 403;
    case 'pin_locked':
      return 429;
    case 'not_valid_now':
      return 409;
    case 'dynamic_qr_disabled':
      return 404;
    case 'invalid_or_expired_token':
      return 400;
    case 'token_already_used':
      return 409;
    case 'scan_expired':
      return 409;
    case 'scan_already_processed':
      return 409;
    case 'pass_expired':
      return 409;
    case 'daily_limit_reached':
    case 'rate_limited':
      return 429;
    case 'no_active_shift':
      return 409;
    case 'not_on_shift_at_access_point':
      return 403;
    case 'foreign_community':
      return 403;
    default:
      return 400;
  }
}

export function sendPassError(reply: FastifyReply, code: PassErrorCode, error = 'Pass rejected') {
  const status = passErrorStatus(code);
  return reply.status(status).send({ statusCode: status, error, message: code });
}
