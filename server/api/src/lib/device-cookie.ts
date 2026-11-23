import type { FastifyRequest } from 'fastify';

/** Legacy single-pass cookie. Kept so devices bound before the change keep access. */
export const PASS_DEVICE_COOKIE = 'pass_device';

/** The link token of a pass this device opened, so the device can return to it. */
export const PASS_LINK_COOKIE = 'pass_link';

/** One binding per pass, so opening a second pass never overwrites the first. */
export function passDeviceCookieName(passId: string): string {
  return `${PASS_DEVICE_COOKIE}_${passId}`;
}

/** One link token per pass; the server only stores its hash and cannot rebuild it. */
export function passLinkCookieName(passId: string): string {
  return `${PASS_LINK_COOKIE}_${passId}`;
}

function serializeCookie(
  value: string,
  maxAgeSeconds: number,
  secure: boolean,
  cookieName: string,
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

export function serializePassDeviceCookie(
  value: string,
  maxAgeSeconds: number,
  secure: boolean,
  cookieName: string = PASS_DEVICE_COOKIE,
): string {
  return serializeCookie(value, maxAgeSeconds, secure, cookieName);
}

export function serializePassLinkCookie(
  linkToken: string,
  maxAgeSeconds: number,
  secure: boolean,
  passId: string,
): string {
  return serializeCookie(linkToken, maxAgeSeconds, secure, passLinkCookieName(passId));
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
  /** True for the old single-pass cookie, which is migrated to the pass-scoped name. */
  legacy: boolean;
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
    bindings.push({ passId: legacy.split('.')[0] ?? '', value: legacy, legacy: true });
  }

  const prefix = `${PASS_DEVICE_COOKIE}_`;
  for (const [name, value] of Object.entries(cookies)) {
    if (!name.startsWith(prefix)) continue;
    const passId = name.slice(prefix.length);
    if (!passId) continue;
    bindings.push({ passId, value, legacy: false });
  }

  return bindings;
}

export interface PassLinkBinding {
  passId: string;
  linkToken: string;
}

/**
 * Every link token the device still remembers. Each pass is looked up by the
 * hash of its token, so the server never needs to store the token itself.
 */
export function readPassLinkBindings(request: FastifyRequest): PassLinkBinding[] {
  const cookies = parseCookies(request.headers.cookie);
  const prefix = `${PASS_LINK_COOKIE}_`;
  const bindings: PassLinkBinding[] = [];

  for (const [name, value] of Object.entries(cookies)) {
    if (!name.startsWith(prefix)) continue;
    const passId = name.slice(prefix.length);
    if (!passId || !value) continue;
    bindings.push({ passId, linkToken: value });
  }

  return bindings;
}
