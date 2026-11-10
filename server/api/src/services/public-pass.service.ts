import bcrypt from 'bcryptjs';
import { and, eq, isNull } from 'drizzle-orm';
import { createDb } from '@porteria/database';
import { accessPasses, communities } from '@porteria/database/schema';
import {
  PassStatus,
  type BindPassDto,
  type PassQrResponse,
  type PassStatusResponse,
  type PublicPassPreview,
} from '@porteria/shared';
import config from '../config.js';
import { randomToken, sha256Hex, verifyDeviceCookie } from '../lib/pass-tokens.js';
import { buildLocationPath } from './location-path.service.js';
import { signPassQrToken } from './pass-qr-token.service.js';
import type { PassResult } from './pass-errors.js';

const db = createDb();

type AccessPassRow = typeof accessPasses.$inferSelect;
type FoundPass = { pass: AccessPassRow; communityName: string; timezone: string };

async function findPassByToken(token: string): Promise<FoundPass | null> {
  const [row] = await db
    .select({
      pass: accessPasses,
      communityName: communities.name,
      timezone: communities.timezone,
    })
    .from(accessPasses)
    .innerJoin(communities, eq(accessPasses.communityId, communities.id))
    .where(eq(accessPasses.linkTokenHash, sha256Hex(token)))
    .limit(1);

  return row ?? null;
}

function isBound(found: FoundPass, cookie: string | null): boolean {
  return Boolean(
    found.pass.deviceKeyHash &&
    verifyDeviceCookie(cookie, found.pass.id, found.pass.deviceKeyHash, config.passes.qrSecret),
  );
}

function isInsideSchedule(pass: AccessPassRow, timezone: string): boolean {
  const now = new Date();
  if (now.getTime() < pass.validFrom.getTime() || now.getTime() > pass.validUntil.getTime()) {
    return false;
  }
  if (!pass.timeFrom || !pass.timeTo) return true;

  const local = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(now);

  const from = pass.timeFrom.slice(0, 5);
  const to = pass.timeTo.slice(0, 5);
  return local >= from && local <= to;
}

function maskDocument(document: string): string {
  const value = document.trim();
  if (value.length <= 4) return '***';
  return `***${value.slice(-4)}`;
}

function checkLink(found: FoundPass): PassResult<null> {
  if (found.pass.linkExpiresAt.getTime() < Date.now()) {
    return { ok: false, code: 'link_expired' };
  }
  return { ok: true, data: null };
}

function checkActive(found: FoundPass): PassResult<null> {
  if (found.pass.status === PassStatus.Used) return { ok: false, code: 'pass_used' };
  if (found.pass.status === PassStatus.Revoked || found.pass.status === PassStatus.Expired) {
    return { ok: false, code: 'gone' };
  }
  return { ok: true, data: null };
}

export async function previewPass(
  token: string,
  cookie: string | null,
): Promise<PassResult<PublicPassPreview>> {
  if (!config.features.dynamicQrEnabled) return { ok: false, code: 'dynamic_qr_disabled' };

  const found = await findPassByToken(token);
  if (!found) return { ok: false, code: 'not_found' };

  const link = checkLink(found);
  if (!link.ok) return link;
  const active = checkActive(found);
  if (!active.ok) return active;

  if (found.pass.deviceKeyHash && !isBound(found, cookie)) {
    return { ok: false, code: 'device_already_bound' };
  }

  return {
    ok: true,
    data: {
      communityName: found.communityName,
      visitorFirstName: found.pass.visitorFirstName,
      maskedDocument: maskDocument(found.pass.visitorDocument),
      locationPath: (await buildLocationPath(found.pass.locationUnitId)) ?? '',
      validFrom: found.pass.validFrom.toISOString(),
      validUntil: found.pass.validUntil.toISOString(),
      timeFrom: found.pass.timeFrom,
      timeTo: found.pass.timeTo,
      vehiclePlate: found.pass.vehiclePlate,
      status: found.pass.status,
      presenceState: found.pass.presenceState,
      pinRequired: found.pass.pinEnabled,
    },
  };
}

export async function bindPass(
  token: string,
  input: BindPassDto,
  cookie: string | null,
): Promise<PassResult<{ passId: string; deviceKey: string | null; linkExpiresAt: Date }>> {
  if (!config.features.dynamicQrEnabled) return { ok: false, code: 'dynamic_qr_disabled' };

  const found = await findPassByToken(token);
  if (!found) return { ok: false, code: 'not_found' };

  const link = checkLink(found);
  if (!link.ok) return link;
  const active = checkActive(found);
  if (!active.ok) return active;

  if (found.pass.deviceKeyHash) {
    if (isBound(found, cookie)) {
      return {
        ok: true,
        data: { passId: found.pass.id, deviceKey: null, linkExpiresAt: found.pass.linkExpiresAt },
      };
    }
    return { ok: false, code: 'device_already_bound' };
  }

  if (found.pass.pinEnabled) {
    if (found.pass.pinLockedUntil && found.pass.pinLockedUntil.getTime() > Date.now()) {
      return { ok: false, code: 'pin_locked' };
    }
    if (!input.pin) return { ok: false, code: 'invalid_pin' };

    const valid = found.pass.pinHash ? await bcrypt.compare(input.pin, found.pass.pinHash) : false;

    if (!valid) {
      const attempts = found.pass.pinFailedAttempts + 1;
      const lockedUntil =
        attempts >= config.passes.pinAttempts
          ? new Date(Date.now() + config.passes.pinLockMinutes * 60_000)
          : null;

      await db
        .update(accessPasses)
        .set({
          pinFailedAttempts: attempts,
          pinLockedUntil: lockedUntil,
          updatedAt: new Date(),
        })
        .where(eq(accessPasses.id, found.pass.id));

      return { ok: false, code: lockedUntil ? 'pin_locked' : 'invalid_pin' };
    }
  }

  const deviceKey = randomToken(32);
  const [updated] = await db
    .update(accessPasses)
    .set({
      deviceKeyHash: sha256Hex(deviceKey),
      boundAt: new Date(),
      pinFailedAttempts: 0,
      pinLockedUntil: null,
      updatedAt: new Date(),
    })
    .where(and(eq(accessPasses.id, found.pass.id), isNull(accessPasses.deviceKeyHash)))
    .returning({ id: accessPasses.id });

  if (!updated) return { ok: false, code: 'device_already_bound' };

  return {
    ok: true,
    data: { passId: found.pass.id, deviceKey, linkExpiresAt: found.pass.linkExpiresAt },
  };
}

export async function getPublicQr(
  token: string,
  cookie: string | null,
): Promise<PassResult<PassQrResponse>> {
  if (!config.features.dynamicQrEnabled) return { ok: false, code: 'dynamic_qr_disabled' };

  const found = await findPassByToken(token);
  if (!found) return { ok: false, code: 'not_found' };

  const link = checkLink(found);
  if (!link.ok) return link;
  const active = checkActive(found);
  if (!active.ok) return active;
  if (!isBound(found, cookie)) return { ok: false, code: 'not_bound' };

  const inside = isInsideSchedule(found.pass, found.timezone);
  if (found.pass.presenceState === 'outside' && !inside) {
    return { ok: false, code: 'not_valid_now' };
  }

  const qr = signPassQrToken(found.pass.id);
  return { ok: true, data: { token: qr.token, expiresAt: qr.expiresAt.toISOString() } };
}

export async function getPublicStatus(
  token: string,
  cookie: string | null,
): Promise<PassResult<PassStatusResponse>> {
  if (!config.features.dynamicQrEnabled) return { ok: false, code: 'dynamic_qr_disabled' };

  const found = await findPassByToken(token);
  if (!found) return { ok: false, code: 'not_found' };

  const link = checkLink(found);
  if (!link.ok) return link;
  if (!isBound(found, cookie)) return { ok: false, code: 'not_bound' };

  return {
    ok: true,
    data: {
      status: found.pass.status,
      presenceState: found.pass.presenceState,
      nextWindow: null,
    },
  };
}
