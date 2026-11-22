import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  PASSWORD_MIN_LENGTH,
  PasswordPolicyError,
  assertPasswordPolicy,
  hashPassword,
  verifyPassword,
} from '../src/services/credentials.service.js';

describe('credentials.service', () => {
  it('genera un hash verificable', async () => {
    const hash = await hashPassword('contrasena-larga');

    assert.match(hash, /^\$2[aby]\$10\$/);
    assert.equal(await verifyPassword('contrasena-larga', hash), true);
  });

  it('rechaza una contraseña que no corresponde', async () => {
    const hash = await hashPassword('contrasena-larga');

    assert.equal(await verifyPassword('otra-contrasena', hash), false);
  });

  it('rechaza cuando no hay hash almacenado', async () => {
    assert.equal(await verifyPassword('contrasena-larga', null), false);
    assert.equal(await verifyPassword('contrasena-larga', undefined), false);
    assert.equal(await verifyPassword('contrasena-larga', ''), false);
  });

  it('usa una sal distinta en cada hash', async () => {
    const first = await hashPassword('contrasena-larga');
    const second = await hashPassword('contrasena-larga');

    assert.notEqual(first, second);
    assert.equal(await verifyPassword('contrasena-larga', first), true);
    assert.equal(await verifyPassword('contrasena-larga', second), true);
  });

  it('exige la longitud mínima al definir la contraseña', async () => {
    const short = 'a'.repeat(PASSWORD_MIN_LENGTH - 1);

    await assert.rejects(
      hashPassword(short),
      (error: unknown) => error instanceof PasswordPolicyError && error.code === 'password_policy',
    );
  });

  it('acepta exactamente la longitud mínima', async () => {
    const exact = 'a'.repeat(PASSWORD_MIN_LENGTH);

    assert.doesNotThrow(() => assertPasswordPolicy(exact));
    assert.equal(await verifyPassword(exact, await hashPassword(exact)), true);
  });

  it('rechaza contraseñas de más de 72 bytes', async () => {
    const tooLong = 'a'.repeat(73);

    assert.throws(() => assertPasswordPolicy(tooLong), PasswordPolicyError);
    assert.equal(await verifyPassword(tooLong, await hashPassword('contrasena-larga')), false);
  });

  it('cuenta los bytes, no los caracteres, para el límite de 72', async () => {
    // 19 emojis: 76 bytes en UTF-8 con sólo 38 unidades de código.
    // bcrypt sólo miraría los primeros 72 bytes.
    const multibyte = '😀'.repeat(19);

    assert.throws(() => assertPasswordPolicy(multibyte), PasswordPolicyError);
  });

  it('no aplica la política al verificar contraseñas existentes', async () => {
    const hash = await hashPassword('contrasena-larga');

    // Una contraseña corta contra un hash válido devuelve false, no lanza.
    assert.equal(await verifyPassword('abc', hash), false);
  });
});
