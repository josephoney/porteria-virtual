import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import jwt from 'jsonwebtoken';

process.env.PASS_QR_SECRET = 'unit-test-pass-secret';
process.env.DYNAMIC_QR_ENABLED = 'true';

const { randomToken, sha256Hex, signDeviceKey, verifyDeviceCookie } =
  await import('../src/lib/pass-tokens.js');
const { signPassQrToken, verifyPassQrToken } =
  await import('../src/services/pass-qr-token.service.js');
const { default: config } = await import('../src/config.js');
const { redactSensitiveUrl } = await import('../src/lib/log-redaction.js');

describe('pass QR tokens', () => {
  it('signs a token with the configured TTL and verifies its claims', () => {
    const { token, jti, expiresAt } = signPassQrToken('pass-1');

    assert.equal(token.split('.').length, 3);
    const payload = verifyPassQrToken(token);
    assert.equal(payload.v, 1);
    assert.equal(payload.passId, 'pass-1');
    assert.equal(payload.jti, jti);
    assert.equal(payload.exp - payload.iat, config.passes.qrTtlSeconds);

    const ttlSeconds = Math.round((expiresAt.getTime() - Date.now()) / 1000);
    assert.ok(ttlSeconds > 0);
    assert.ok(ttlSeconds <= config.passes.qrTtlSeconds);
  });

  it('rejects a tampered token', () => {
    const { token } = signPassQrToken('pass-1');
    assert.throws(() => verifyPassQrToken(`${token.slice(0, -1)}x`));
  });

  it('rejects an expired token', () => {
    const expired = jwt.sign({ v: 1, passId: 'pass-1' }, config.passes.qrSecret, {
      algorithm: 'HS256',
      jwtid: 'expired-jti',
      expiresIn: -1,
    });

    assert.throws(() => verifyPassQrToken(expired));
  });

  it('rejects a token signed with another secret', () => {
    const foreign = jwt.sign({ v: 1, passId: 'pass-1' }, 'another-secret', {
      algorithm: 'HS256',
      jwtid: 'foreign-jti',
      expiresIn: 24,
    });

    assert.throws(() => verifyPassQrToken(foreign));
  });

  it('rejects a token without the expected claims', () => {
    const missingPass = jwt.sign({ v: 1 }, config.passes.qrSecret, {
      algorithm: 'HS256',
      jwtid: 'missing-pass',
      expiresIn: 24,
    });
    const missingVersion = jwt.sign({ passId: 'pass-1' }, config.passes.qrSecret, {
      algorithm: 'HS256',
      jwtid: 'missing-version',
      expiresIn: 24,
    });

    assert.throws(() => verifyPassQrToken(missingPass));
    assert.throws(() => verifyPassQrToken(missingVersion));
  });
});

describe('log redaction', () => {
  it('masks the public pass token in request URLs', () => {
    assert.equal(redactSensitiveUrl('/api/public/passes/abc123'), '/api/public/passes/:token');
    assert.equal(
      redactSensitiveUrl('/api/public/passes/abc123/qr?x=1'),
      '/api/public/passes/:token/qr?x=1',
    );
    assert.equal(
      redactSensitiveUrl('/api/public/passes/abc123/bind'),
      '/api/public/passes/:token/bind',
    );
    assert.equal(redactSensitiveUrl('/api/passes/abc123/qr'), '/api/passes/abc123/qr');
  });
});

describe('pass token helpers', () => {
  it('produces 32-byte hex tokens and deterministic SHA-256 hashes', () => {
    const token = randomToken(32);

    assert.equal(token.length, 64);
    assert.match(token, /^[a-f0-9]{64}$/);
    assert.equal(sha256Hex(token), sha256Hex(token));
    assert.equal(sha256Hex(token).length, 64);
  });

  it('accepts a valid device cookie and rejects tampering or scope changes', () => {
    const deviceKey = randomToken(32);
    const deviceHash = sha256Hex(deviceKey);
    const signature = signDeviceKey('pass-1', deviceKey, config.passes.qrSecret);
    const cookie = `pass-1.${deviceKey}.${signature}`;

    assert.equal(verifyDeviceCookie(cookie, 'pass-1', deviceHash, config.passes.qrSecret), true);
    assert.equal(verifyDeviceCookie(cookie, 'pass-2', deviceHash, config.passes.qrSecret), false);
    assert.equal(verifyDeviceCookie(cookie, 'pass-1', deviceHash, 'wrong-secret'), false);
    assert.equal(
      verifyDeviceCookie(cookie, 'pass-1', sha256Hex(randomToken(32)), config.passes.qrSecret),
      false,
    );
    assert.equal(
      verifyDeviceCookie('malformed', 'pass-1', deviceHash, config.passes.qrSecret),
      false,
    );
    assert.equal(verifyDeviceCookie(null, 'pass-1', deviceHash, config.passes.qrSecret), false);
  });
});
