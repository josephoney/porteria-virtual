import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import { requireRole } from '../middlewares/rbac.js';
import {
  canManagePassword,
  loadTarget,
  type PasswordActor,
} from '../services/account-password.service.js';
import { resetAccountPassword } from '../services/account-password-reset.service.js';

interface AccountUser {
  sub: string;
  accountId?: string | null;
  personId?: string | null;
  orgId: string;
  communityId?: string | null;
  role: string;
  isPlatformAdmin?: boolean;
}

function toActor(user: AccountUser): PasswordActor {
  return {
    accountId: user.accountId ?? null,
    personId: user.personId ?? null,
    orgId: user.orgId,
    communityId: user.communityId ?? null,
    role: user.role,
    isPlatformAdmin: Boolean(user.isPlatformAdmin),
  };
}

function forbid(reply: FastifyReply) {
  return reply.status(403).send({
    statusCode: 403,
    error: 'Forbidden',
    message: 'No puedes cambiar la contraseña de esta cuenta',
  });
}

/**
 * Cambio de contraseña por parte de un administrador.
 *
 * El alcance se decide acá, no en la interfaz: esconder el botón no impide
 * llamar la API.
 */
export async function accountPasswordRoutes(app: FastifyInstance) {
  app.post(
    '/:id/password',
    { preHandler: [requireRole('community_admin', 'org_admin')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = request.user as AccountUser;
      const actor = toActor(user);
      const { id } = request.params as { id: string };
      const body = (request.body ?? {}) as {
        mode?: unknown;
        password?: unknown;
        mustChange?: unknown;
      };

      const mode = body.mode === 'link' ? 'link' : body.mode === 'direct' ? 'direct' : null;
      if (!mode) {
        return reply
          .status(400)
          .send({ statusCode: 400, error: 'Bad Request', message: 'mode debe ser direct o link' });
      }

      const target = await loadTarget(id);
      if (!target || !target.active) {
        return reply
          .status(404)
          .send({ statusCode: 404, error: 'Not Found', message: 'La cuenta no existe' });
      }
      if (!canManagePassword(actor, target)) return forbid(reply);

      const result = await resetAccountPassword(actor, target, {
        mode,
        password: typeof body.password === 'string' ? body.password : undefined,
        // En modo enlace el cambio es forzoso por definición.
        mustChange: mode === 'link' ? true : body.mustChange !== false,
      });

      if (!result.ok) {
        if (result.code === 'weak_password') {
          return reply.status(400).send({
            statusCode: 400,
            error: 'Bad Request',
            message: 'La contraseña debe tener al menos ocho caracteres',
          });
        }
        return forbid(reply);
      }

      return reply.status(200).send({ data: result.data });
    },
  );
}
