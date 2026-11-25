import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import type { FastifyInstance } from 'fastify';

process.env.OUTBOX_WORKER_ENABLED = 'false';
process.env.NODE_ENV = 'test';

import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';

import { createDb } from '@porteria/database';
import { accounts, passwordResetTokens, people, refreshTokens } from '@porteria/database/schema';

import { randomToken, sha256Hex } from '../src/lib/pass-tokens.js';
import {
  requestPasswordReset,
  resetPassword,
  RESET_TOKEN_MINUTES,
} from '../src/services/password-reset.service.js';

const db = createDb();

let app: FastifyInstance;
let accountId: string;
let personId: string;
let refreshTokenId: string;
let email: string;

/** Siembra un enlace con un token conocido: el servicio sólo guarda el hash. */
async function seedToken(token: string, expiresAt: Date, usedAt: Date | null = null) {
  const [row] = await db
    .insert(passwordResetTokens)
    .values({ accountId, tokenHash: sha256Hex(token), expiresAt, usedAt })
    .returning();
  return row;
}

describe('recuperación de contraseña', () => {
  before(async () => {
    const suffix = randomUUID().slice(0, 8);
    const { buildApp } = await import('../src/index.js');
    app = (await buildApp()).app;

    const [person] = await db
      .insert(people)
      .values({ firstName: 'Olvido', lastName: 'Clave', documentType: 'CC' })
      .returning();
    personId = person.id;

    email = `olvido-${suffix}@test.local`;
    const [account] = await db
      .insert(accounts)
      .values({
        personId,
        email,
        passwordHash: await bcrypt.hash('clave-vieja-123', 10),
      })
      .returning();
    accountId = account.id;

    // Una sesión abierta con la contraseña vieja: el reset tiene que cerrarla.
    const [session] = await db
      .insert(refreshTokens)
      .values({
        accountId,
        tokenHash: sha256Hex(`refresh-${suffix}`),
        expiresAt: new Date(Date.now() + 86_400_000),
      })
      .returning();
    refreshTokenId = session.id;
  });

  after(async () => {
    await db.delete(passwordResetTokens).where(eq(passwordResetTokens.accountId, accountId));
    await db.delete(refreshTokens).where(eq(refreshTokens.accountId, accountId));
    await db.delete(accounts).where(eq(accounts.id, accountId));
    await db.delete(people).where(eq(people.id, personId));
    await app.close();
  });

  it('genera un enlace y anula el anterior', async () => {
    const first = await requestPasswordReset(email, '127.0.0.1');
    assert.equal(first.ok, true);

    const afterFirst = await db
      .select()
      .from(passwordResetTokens)
      .where(eq(passwordResetTokens.accountId, accountId));
    assert.equal(afterFirst.length, 1);
    assert.equal(afterFirst[0].usedAt, null);

    const second = await requestPasswordReset(email.toUpperCase(), '127.0.0.1');
    assert.equal(second.ok, true);

    const rows = await db
      .select()
      .from(passwordResetTokens)
      .where(eq(passwordResetTokens.accountId, accountId));
    assert.equal(rows.length, 2);
    // Sólo el último enlace sirve.
    assert.equal(rows.filter((row) => row.usedAt === null).length, 1);
  });

  it('no distingue un correo inexistente de uno registrado', async () => {
    const missing = await requestPasswordReset(`nadie-${randomUUID()}@test.local`, null);
    assert.equal(missing.ok, true);
    assert.equal(missing.ok && missing.data.sent, false);
  });

  it('cambia la contraseña, revoca las sesiones y consume el enlace', async () => {
    const token = randomToken(32);
    await seedToken(token, new Date(Date.now() + RESET_TOKEN_MINUTES * 60_000));

    const newHash = await bcrypt.hash('clave-nueva-456', 10);
    const result = await resetPassword(token, newHash);
    assert.equal(result.ok, true);

    const [account] = await db.select().from(accounts).where(eq(accounts.id, accountId)).limit(1);
    assert.equal(await bcrypt.compare('clave-nueva-456', account.passwordHash), true);
    assert.equal(await bcrypt.compare('clave-vieja-123', account.passwordHash), false);

    const [session] = await db
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.id, refreshTokenId))
      .limit(1);
    assert.equal(session.revoked, true);

    const [row] = await db
      .select()
      .from(passwordResetTokens)
      .where(eq(passwordResetTokens.tokenHash, sha256Hex(token)))
      .limit(1);
    assert.ok(row.usedAt, 'el enlace queda marcado como usado');
  });

  it('rechaza un enlace ya usado', async () => {
    const token = randomToken(32);
    await seedToken(token, new Date(Date.now() + 60_000), new Date());

    const result = await resetPassword(token, await bcrypt.hash('otra-clave-789', 10));
    assert.equal(result.ok, false);
    assert.equal(!result.ok && result.code, 'invalid_token');
  });

  it('rechaza un enlace vencido', async () => {
    const token = randomToken(32);
    await seedToken(token, new Date(Date.now() - 60_000));

    const result = await resetPassword(token, await bcrypt.hash('otra-clave-789', 10));
    assert.equal(result.ok, false);
    assert.equal(!result.ok && result.code, 'expired_token');
  });

  it('la ruta pública responde igual para cualquier correo', async () => {
    const known = await app.inject({
      method: 'POST',
      url: '/api/auth/password/forgot',
      payload: { email },
    });
    const unknown = await app.inject({
      method: 'POST',
      url: '/api/auth/password/forgot',
      payload: { email: `fantasma-${randomUUID()}@test.local` },
    });

    assert.equal(known.statusCode, 202);
    assert.equal(unknown.statusCode, 202);
    assert.deepEqual(JSON.parse(known.body), JSON.parse(unknown.body));
  });

  it('rechaza una contraseña corta y un token desconocido', async () => {
    const short = await app.inject({
      method: 'POST',
      url: '/api/auth/password/reset',
      payload: { token: randomToken(32), password: 'corta' },
    });
    assert.equal(short.statusCode, 400);

    const unknown = await app.inject({
      method: 'POST',
      url: '/api/auth/password/reset',
      payload: { token: randomToken(32), password: 'clave-valida-123' },
    });
    assert.equal(unknown.statusCode, 400);
  });

  it('no deja rastros de la contraseña en la base', async () => {
    const [account] = await db.select().from(accounts).where(eq(accounts.id, accountId)).limit(1);
    assert.ok(!account.passwordHash.includes('clave-nueva-456'));
    assert.match(account.passwordHash, /^\$2[aby]\$/);
  });
});
