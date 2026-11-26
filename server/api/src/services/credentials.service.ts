import bcrypt from 'bcryptjs';
import { and, eq } from 'drizzle-orm';
import { createDb } from '@porteria/database';
import { accounts, refreshTokens } from '@porteria/database/schema';

/**
 * Conexión perezosa: este módulo se importa desde tests unitarios que no
 * tocan la base, así que no debe abrir un pool al cargarse.
 */
let connection: ReturnType<typeof createDb> | null = null;

function getDb(): ReturnType<typeof createDb> {
  connection ??= createDb();
  return connection;
}

/** Longitud mínima aceptada para una contraseña de cuenta. */
export const PASSWORD_MIN_LENGTH = 8;

/**
 * bcrypt ignora silenciosamente todo lo que pase de 72 bytes. Si no lo
 * rechazamos, dos contraseñas distintas con el mismo prefijo de 72 bytes
 * autentican igual.
 */
const PASSWORD_MAX_BYTES = 72;

/** Costo de bcrypt. Coincide con el que ya usaba el proyecto. */
const BCRYPT_ROUNDS = 10;

export class PasswordPolicyError extends Error {
  readonly code = 'password_policy';

  constructor(message: string) {
    super(message);
    this.name = 'PasswordPolicyError';
  }
}

export function assertPasswordPolicy(password: string): void {
  if (password.length < PASSWORD_MIN_LENGTH) {
    throw new PasswordPolicyError(
      `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres`,
    );
  }

  if (Buffer.byteLength(password, 'utf8') > PASSWORD_MAX_BYTES) {
    throw new PasswordPolicyError(`La contraseña no puede superar los ${PASSWORD_MAX_BYTES} bytes`);
  }
}

export async function hashPassword(password: string): Promise<string> {
  assertPasswordPolicy(password);
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/**
 * Verifica una contraseña contra un hash almacenado. No aplica la política:
 * los hashes existentes pueden haberse creado con reglas anteriores.
 */
export async function verifyPassword(
  password: string,
  passwordHash: string | null | undefined,
): Promise<boolean> {
  if (!passwordHash) return false;
  if (password.length === 0) return false;
  if (Buffer.byteLength(password, 'utf8') > PASSWORD_MAX_BYTES) return false;
  return bcrypt.compare(password, passwordHash);
}

/**
 * Revoca todas las sesiones activas de una cuenta.
 *
 * Se llama en cada cambio de contraseña: sin esto, una sesión robada sigue
 * válida después de que la víctima cambió la credencial.
 */
export async function revokeAllSessions(accountId: string): Promise<void> {
  await getDb()
    .update(refreshTokens)
    .set({ revoked: true })
    .where(and(eq(refreshTokens.accountId, accountId), eq(refreshTokens.revoked, false)));
}

export interface SetPasswordOptions {
  /** Por defecto `true`: cambiar la contraseña cierra las sesiones abiertas. */
  revokeSessions?: boolean;
}

/**
 * Guarda una contraseña nueva en `accounts`, la única fuente de verdad.
 *
 * La escritura y la revocación de sesiones van en la misma transacción: no
 * puede quedar una contraseña nueva con sesiones viejas vivas.
 */
export async function setPassword(
  accountId: string,
  password: string,
  options: SetPasswordOptions = {},
): Promise<void> {
  const passwordHash = await hashPassword(password);
  const revokeSessions = options.revokeSessions ?? true;

  await getDb().transaction(async (tx) => {
    const [updated] = await tx
      .update(accounts)
      .set({
        passwordHash,
        mustChangePassword: false,
        activatedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(accounts.id, accountId))
      .returning({ id: accounts.id });

    if (!updated) {
      throw new Error('Account not found');
    }

    if (revokeSessions) {
      await tx
        .update(refreshTokens)
        .set({ revoked: true })
        .where(and(eq(refreshTokens.accountId, accountId), eq(refreshTokens.revoked, false)));
    }
  });
}
