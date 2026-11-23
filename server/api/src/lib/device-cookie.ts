import type { FastifyRequest } from 'fastify';

/** Legacy single-pass cookie. Kept so devices bound before the change keep access. */
export const PASS_DEVICE_COOKIE = 'pass_device';

/** One binding per pass, so opening a second pass never overwrites the first. */
export function passDeviceCookieName(passId: string): string {
  return `${PASS_DEVICE_COOKIE}_${passId}`;
}

export function serializePassDeviceCookie(
  value: string,
  maxAgeSeconds: number,
  secure: boolean,
  cookieName: string = PASS_DEVICE_COOKIE,
): string {
  const parts = [
    `${cookieName}=${encodeURIComponent(value)}`,
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

export interface PassDeviceBinding {
  passId: string;
  value: string;
}

/**
 * Every device binding the request presents: one per pass from the pass-scoped
 * cookies, plus the legacy single-pass cookie when it is still around.
 */
export function readPassDeviceBindings(request: FastifyRequest): PassDeviceBinding[] {
  const cookies = parseCookies(request.headers.cookie);
  const bindings: PassDeviceBinding[] = [];

  const legacy = cookies[PASS_DEVICE_COOKIE];
  if (legacy) {
    bindings.push({ passId: legacy.split('.')[0] ?? '', value: legacy });
  }

  const prefix = `${PASS_DEVICE_COOKIE}_`;
  for (const [name, value] of Object.entries(cookies)) {
    if (!name.startsWith(prefix)) continue;
    const passId = name.slice(prefix.length);
    if (!passId) continue;
    bindings.push({ passId, value });
  }

  return bindings;
}
