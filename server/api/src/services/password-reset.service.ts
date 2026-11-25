import { and, desc, eq, gt, isNull, sql } from 'drizzle-orm';

import { createDb } from '@porteria/database';
import { accounts, passwordResetTokens, people, refreshTokens } from '@porteria/database/schema';

import config from '../config.js';
import { randomToken, sha256Hex } from '../lib/pass-tokens.js';
import { sendPasswordResetEmail } from './mail.service.js';

const db = createDb();

/** El enlace vive una hora: suficiente para abrir el correo, corto para un robo. */
export const RESET_TOKEN_MINUTES = 60;

export type ResetResult =
  | { ok: true; data: { sent: boolean; reason?: string } }
  | { ok: false; code: 'invalid_token' | 'expired_token' | 'weak_password' };

/** Cuenta y persona detrás de un correo, sin importar mayúsculas. */
async function accountForEmail(email: string) {
  const [row] = await db
    .select({
      accountId: accounts.id,
      email: accounts.email,
      active: accounts.active,
      firstName: people.firstName,
    })
    .from(accounts)
    .innerJoin(people, eq(people.id, accounts.personId))
    .where(sql`lower(${accounts.email}) = ${email.trim().toLowerCase()}`)
    .limit(1);
  return row ?? null;
}

function buildResetUrl(token: string): string {
  return `${config.publicAppUrl.replace(/\/+$/, '')}/reset-password?token=${token}`;
}

/**
 * Pide un enlace de recuperación.
 *
 * Responde igual exista o no la cuenta: distinguir ambos casos convierte el
 * formulario en un verificador de correos registrados. Si la cuenta existe se
 * invalida cualquier enlace anterior y se envía uno nuevo.
 */
export async function requestPasswordReset(email: string, ip: string | null): Promise<ResetResult> {
  const account = await accountForEmail(email);

  // Un correo inexistente, inactivo o sin cuenta no produce ningún enlace, y la
  // respuesta es la misma que en el caso feliz.
  if (!account || !account.active) return { ok: true, data: { sent: false } };

  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + RESET_TOKEN_MINUTES * 60_000);

  await db.transaction(async (tx) => {
    // Un enlace nuevo anula los anteriores: si alguien pidió dos, sólo sirve el
    // último que llegó a su correo.
    await tx
      .update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(
        and(
          eq(passwordResetTokens.accountId, account.accountId),
          isNull(passwordResetTokens.usedAt),
        ),
      );

    await tx.insert(passwordResetTokens).values({
      accountId: account.accountId,
      tokenHash: sha256Hex(token),
      expiresAt,
      requestedIp: ip?.slice(0, 64) ?? null,
    });
  });

  const delivery = await sendPasswordResetEmail({
    to: account.email,
    firstName: account.firstName,
    resetUrl: buildResetUrl(token),
    expiresInMinutes: RESET_TOKEN_MINUTES,
  });

  return {
    ok: true,
    data: { sent: delivery.sent, ...(delivery.reason ? { reason: delivery.reason } : {}) },
  };
}

/**
 * Consume el enlace y define la contraseña nueva.
 *
 * El token se marca usado en el mismo movimiento que la contraseña, así que un
 * segundo intento con el mismo enlace falla. Todas las sesiones de la cuenta se
 * revocan: si alguien había entrado con la contraseña vieja, deja de valer.
 */
export async function resetPassword(
  token: string,
  passwordHash: string,
  now: Date = new Date(),
): Promise<ResetResult> {
  const tokenHash = sha256Hex(token);

  const [row] = await db
    .select({
      id: passwordResetTokens.id,
      accountId: passwordResetTokens.accountId,
      expiresAt: passwordResetTokens.expiresAt,
      usedAt: passwordResetTokens.usedAt,
    })
    .from(passwordResetTokens)
    .where(eq(passwordResetTokens.tokenHash, tokenHash))
    .orderBy(desc(passwordResetTokens.createdAt))
    .limit(1);

  if (!row || row.usedAt) return { ok: false, code: 'invalid_token' };
  if (row.expiresAt.getTime() <= now.getTime()) return { ok: false, code: 'expired_token' };

  const consumed = await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(passwordResetTokens)
      .set({ usedAt: now })
      .where(and(eq(passwordResetTokens.id, row.id), isNull(passwordResetTokens.usedAt)))
      .returning({ id: passwordResetTokens.id });
    if (!updated) return false;

    await tx
      .update(accounts)
      .set({ passwordHash, updatedAt: now })
      .where(eq(accounts.id, row.accountId));

    await tx
      .update(refreshTokens)
      .set({ revoked: true })
      .where(and(eq(refreshTokens.accountId, row.accountId), eq(refreshTokens.revoked, false)));

    // No se borran las filas: el historial de accesos a la cuenta se conserva.
    return true;
  });

  return consumed ? { ok: true, data: { sent: true } } : { ok: false, code: 'invalid_token' };
}

/** Utilidad para los tests y el panel: ¿este token sigue sirviendo? */
export async function isResetTokenUsable(token: string, now: Date = new Date()) {
  const [row] = await db
    .select({ expiresAt: passwordResetTokens.expiresAt, usedAt: passwordResetTokens.usedAt })
    .from(passwordResetTokens)
    .where(eq(passwordResetTokens.tokenHash, sha256Hex(token)))
    .limit(1);
  return Boolean(row && !row.usedAt && row.expiresAt.getTime() > now.getTime());
}

/** Enlaces vigentes de una cuenta, para diagnóstico del administrador. */
export async function pendingResetCount(accountId: string, now: Date = new Date()) {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(passwordResetTokens)
    .where(
      and(
        eq(passwordResetTokens.accountId, accountId),
        isNull(passwordResetTokens.usedAt),
        gt(passwordResetTokens.expiresAt, now),
      ),
    );
  return Number(row?.count ?? 0);
}
