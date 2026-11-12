import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';

export function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('hex');
}

/**
 * The stored hash is what validates a public link, but the resident also needs
 * to read the link again from the history. AES-GCM keeps a recoverable copy
 * without ever storing the token in clear text.
 */
function linkKey(secret: string): Buffer {
  return createHash('sha256').update(`${secret}.link.v1`).digest();
}

export function encryptLinkToken(token: string, secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', linkKey(secret), iv);
  const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  return [iv.toString('hex'), cipher.getAuthTag().toString('hex'), encrypted.toString('hex')].join(
    '.',
  );
}

export function decryptLinkToken(payload: string, secret: string): string | null {
  const parts = payload.split('.');
  if (parts.length !== 3) return null;
  try {
    const decipher = createDecipheriv('aes-256-gcm', linkKey(secret), Buffer.from(parts[0], 'hex'));
    decipher.setAuthTag(Buffer.from(parts[1], 'hex'));
    return Buffer.concat([
      decipher.update(Buffer.from(parts[2], 'hex')),
      decipher.final(),
    ]).toString('utf8');
  } catch {
    return null;
  }
}

export function signDeviceKey(passId: string, deviceKey: string, secret: string): string {
  return createHmac('sha256', secret).update(`${passId}.${deviceKey}`).digest('hex');
}

export function safeEqualHex(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  const a = Buffer.from(left, 'hex');
  const b = Buffer.from(right, 'hex');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function verifyDeviceCookie(
  cookieValue: string | null,
  passId: string,
  expectedHash: string,
  secret: string,
): boolean {
  if (!cookieValue) return false;
  const parts = cookieValue.split('.');
  if (parts.length !== 3) return false;
  const [cookiePassId, deviceKey, signature] = parts;
  if (cookiePassId !== passId) return false;
  if (!safeEqualHex(signDeviceKey(passId, deviceKey, secret), signature)) return false;
  return safeEqualHex(sha256Hex(deviceKey), expectedHash);
}
