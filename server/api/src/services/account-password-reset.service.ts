import bcrypt from 'bcryptjs';
import { and, eq } from 'drizzle-orm';

import { createDb } from '@porteria/database';
import { accounts, refreshTokens } from '@porteria/database/schema';

import { insertEvent } from './events.service.js';
import { deliverResetEmail, issueResetToken } from './password-reset.service.js';
import type {
  ManageResult,
  PasswordActor,
  ResetPasswordInput,
} from './account-password.service.js';

const db = createDb();
const MIN_PASSWORD_LENGTH = 8;

export interface ResetOutcome {
  mode: 'direct' | 'link';
  /** Sólo en modo directo: la contraseña temporal se muestra una vez. */
  temporaryPassword?: string;
  /** Sólo en modo enlace: si el correo salió. */
  sent?: boolean;
  mustChange: boolean;
}

/**
 * Resetea la contraseña de otra cuenta.
 *
 * Dos modos: `direct` entrega una contraseña temporal que el administrador ve
 * una sola vez, y `link` manda el enlace para que la persona defina la suya. En
 * ambos se revocan las sesiones abiertas y se registra el evento sin guardar
 * ninguna contraseña.
 */
export async function resetAccountPassword(
  actor: PasswordActor,
  target: { accountId: string; email: string; firstName: string },
  input: ResetPasswordInput,
): Promise<ManageResult<ResetOutcome>> {
  const now = new Date();
  let temporaryPassword: string | undefined;
  let sent: boolean | undefined;

  if (input.mode === 'direct') {
    const password = input.password ?? '';
    if (password.length < MIN_PASSWORD_LENGTH) return { ok: false, code: 'weak_password' };

    const passwordHash = await bcrypt.hash(password, 10);
    await db
      .update(accounts)
      .set({
        passwordHash,
        mustChangePassword: input.mustChange,
        activatedAt: now,
        updatedAt: now,
      })
      .where(eq(accounts.id, target.accountId));
    temporaryPassword = password;
  } else {
    const { token } = await issueResetToken(target.accountId, null);
    const delivery = await deliverResetEmail(target.email, target.firstName, token);
    sent = delivery.sent;
    // El enlace obliga a definir la contraseña, así que el cambio es forzoso.
    await db
      .update(accounts)
      .set({ mustChangePassword: true, updatedAt: now })
      .where(eq(accounts.id, target.accountId));
  }

  await db
    .update(refreshTokens)
    .set({ revoked: true })
    .where(and(eq(refreshTokens.accountId, target.accountId), eq(refreshTokens.revoked, false)));

  await insertEvent({
    eventType: 'account.password.reset',
    actorId: actor.accountId ?? undefined,
    actorPersonId: actor.personId ?? undefined,
    actorRole: actor.role,
    organizationId: actor.orgId,
    metadata: {
      targetAccountId: target.accountId,
      mode: input.mode,
      mustChange: input.mustChange,
      mailSent: sent ?? null,
    },
  });

  return {
    ok: true,
    data: {
      mode: input.mode,
      ...(temporaryPassword ? { temporaryPassword } : {}),
      ...(sent === undefined ? {} : { sent }),
      mustChange: input.mustChange,
    },
  };
}
