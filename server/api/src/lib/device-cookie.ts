import type { FastifyRequest } from 'fastify';

export const PASS_DEVICE_COOKIE = 'pass_device';

export function serializePassDeviceCookie(
  value: string,
  maxAgeSeconds: number,
  secure: boolean,
): string {
  const parts = [
    `${PASS_DEVICE_COOKIE}=${encodeURIComponent(value)}`,
    'HttpOnly',
    'SameSite=Lax',
    'Path=/api/public/passes',
    `Max-Age=${Math.max(0, Math.floor(maxAgeSeconds))}`,
  ];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

export function parseCookies(header: string | undefined): Record<string, string> {
  if (!header) return {};
  const result: Record<string, string> = {};
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index === -1) continue;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (!key) continue;
    try {
      result[key] = decodeURIComponent(value);
    } catch {
      result[key] = value;
    }
  }
  return result;
}

export function readPassDeviceCookie(request: FastifyRequest): string | null {
  return parseCookies(request.headers.cookie)[PASS_DEVICE_COOKIE] ?? null;
}
