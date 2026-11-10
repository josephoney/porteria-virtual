import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('hex');
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
