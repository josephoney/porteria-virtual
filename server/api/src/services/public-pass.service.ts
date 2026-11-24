import bcrypt from 'bcryptjs';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { createDb } from '@porteria/database';
import { accessPasses, communities } from '@porteria/database/schema';
import {
  PassStatus,
  passTicketState,
  type BindPassDto,
  type DevicePassEntry,
  type PassQrResponse,
  type PassStatusResponse,
  type PublicPassPreview,
} from '@porteria/shared';
import config from '../config.js';
import type { PassDeviceBinding, PassLinkBinding } from '../lib/device-cookie.js';
import { randomToken, sha256Hex, verifyDeviceCookie } from '../lib/pass-tokens.js';
import { buildLocationPath } from './location-path.service.js';
import { buildPassRule } from './pass-schedule.service.js';
import { signPassQrToken } from './pass-qr-token.service.js';
import type { PassGrant, PassResult } from './pass-errors.js';

const db = createDb();

type AccessPassRow = typeof accessPasses.$inferSelect;
type FoundPass = {
  pass: AccessPassRow;
  communityName: string;
  timezone: string;
  dynamicQrEnabled: boolean;
};

async function findPassByToken(token: string): Promise<FoundPass | null> {
  const [row] = await db
    .select({
      pass: accessPasses,
      communityName: communities.name,
      timezone: communities.timezone,
      dynamicQrEnabled: communities.dynamicQrEnabled,
    })
    .from(accessPasses)
    .innerJoin(communities, eq(accessPasses.communityId, communities.id))
    .where(eq(accessPasses.linkTokenHash, sha256Hex(token)))
    .limit(1);

  return row ?? null;
}

/**
 * The binding that actually authorizes this pass. The pass-scoped cookie wins
 * over the legacy one: the old name only survives the transition.
 */
function provenBinding(found: FoundPass, bindings: PassDeviceBinding[]): PassDeviceBinding | null {
  const deviceKeyHash = found.pass.deviceKeyHash;
  if (!deviceKeyHash) return null;

  const matches = bindings.filter(
    (binding) =>
      binding.passId === found.pass.id &&
      verifyDeviceCookie(binding.value, found.pass.id, deviceKeyHash, config.passes.qrSecret),
  );

  return matches.find((binding) => !binding.legacy) ?? matches[0] ?? null;
}

function isBound(found: FoundPass, bindings: PassDeviceBinding[]): boolean {
  return provenBinding(found, bindings) !== null;
}

/**
 * What the route needs to write the cookies that keep this device authorized:
 * the pass, its link lifetime, and the legacy cookie value to migrate when that
 * is what proved the binding.
 */
function grantFor(found: FoundPass, bindings: PassDeviceBinding[]): PassGrant {
  const proven = provenBinding(found, bindings);
  return {
    passId: found.pass.id,
    linkExpiresAt: found.pass.linkExpiresAt,
    legacyCookie: proven?.legacy ? proven.value : null,
  };
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

/**
 * The dynamic QR is a rule of the community: a pass issued by a community that
 * turned it off stops resolving its link and its code. The environment switch is
 * checked first, without touching the database, because it turns the feature off
 * for every community at once.
 */
function checkDynamicQr(found: FoundPass): PassResult<null> {
  if (!config.features.dynamicQrEnabled || !found.dynamicQrEnabled) {
    return { ok: false, code: 'dynamic_qr_disabled' };
  }
  return { ok: true, data: null };
}

export async function previewPass(
  token: string,
  bindings: PassDeviceBinding[],
): Promise<PassResult<PublicPassPreview>> {
  if (!config.features.dynamicQrEnabled) return { ok: false, code: 'dynamic_qr_disabled' };

  const found = await findPassByToken(token);
  if (!found) return { ok: false, code: 'not_found' };

  const qrGate = checkDynamicQr(found);
  if (!qrGate.ok) return qrGate;

  const link = checkLink(found);
  if (!link.ok) return link;
  const active = checkActive(found);
  if (!active.ok) return active;

  if (found.pass.deviceKeyHash && !isBound(found, bindings)) {
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
      companionCount: found.pass.companions.length,
      status: found.pass.status,
      presenceState: found.pass.presenceState,
      pinRequired: found.pass.pinEnabled,
      type: found.pass.type,
      recurrence: found.pass.recurrence,
      maxUses: found.pass.maxUses,
      exitCount: found.pass.exitCount,
      remainingUses: (await buildPassRule(found.pass, found.timezone, new Date())).remainingUses,
    },
    grant: grantFor(found, bindings),
  };
}

export async function bindPass(
  token: string,
  input: BindPassDto,
  bindings: PassDeviceBinding[],
): Promise<PassResult<{ passId: string; deviceKey: string | null; linkExpiresAt: Date }>> {
  if (!config.features.dynamicQrEnabled) return { ok: false, code: 'dynamic_qr_disabled' };

  const found = await findPassByToken(token);
  if (!found) return { ok: false, code: 'not_found' };

  const qrGate = checkDynamicQr(found);
  if (!qrGate.ok) return qrGate;

  const link = checkLink(found);
  if (!link.ok) return link;
  const active = checkActive(found);
  if (!active.ok) return active;

  if (found.pass.deviceKeyHash) {
    if (isBound(found, bindings)) {
      return {
        ok: true,
        data: { passId: found.pass.id, deviceKey: null, linkExpiresAt: found.pass.linkExpiresAt },
        grant: grantFor(found, bindings),
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
    grant: { passId: found.pass.id, linkExpiresAt: found.pass.linkExpiresAt, legacyCookie: null },
  };
}

export async function getPublicQr(
  token: string,
  bindings: PassDeviceBinding[],
): Promise<PassResult<PassQrResponse>> {
  if (!config.features.dynamicQrEnabled) return { ok: false, code: 'dynamic_qr_disabled' };

  const found = await findPassByToken(token);
  if (!found) return { ok: false, code: 'not_found' };

  const qrGate = checkDynamicQr(found);
  if (!qrGate.ok) return qrGate;

  const link = checkLink(found);
  if (!link.ok) return link;
  const active = checkActive(found);
  if (!active.ok) return active;
  if (!isBound(found, bindings)) return { ok: false, code: 'not_bound' };

  const inside = isInsideSchedule(found.pass, found.timezone);
  if (found.pass.presenceState === 'outside' && !inside) {
    return { ok: false, code: 'not_valid_now' };
  }

  const qr = signPassQrToken(found.pass.id);
  return {
    ok: true,
    data: {
      token: qr.token,
      expiresAt: qr.expiresAt.toISOString(),
      expiresInSeconds: config.passes.qrTtlSeconds,
    },
    grant: grantFor(found, bindings),
  };
}

export async function getPublicStatus(
  token: string,
  bindings: PassDeviceBinding[],
): Promise<PassResult<PassStatusResponse>> {
  if (!config.features.dynamicQrEnabled) return { ok: false, code: 'dynamic_qr_disabled' };

  const found = await findPassByToken(token);
  if (!found) return { ok: false, code: 'not_found' };

  const qrGate = checkDynamicQr(found);
  if (!qrGate.ok) return qrGate;

  const link = checkLink(found);
  if (!link.ok) return link;
  if (!isBound(found, bindings)) return { ok: false, code: 'not_bound' };

  return {
    ok: true,
    data: {
      status: found.pass.status,
      presenceState: found.pass.presenceState,
      nextWindow: null,
      exitCount: found.pass.exitCount,
      remainingUses: (await buildPassRule(found.pass, found.timezone, new Date())).remainingUses,
    },
    grant: grantFor(found, bindings),
  };
}

/** Only these ticket states still have an active QR behind them. */
function isActionableTicket(ticket: DevicePassEntry['ticket']): boolean {
  return ticket.kind === 'pending' || ticket.kind === 'reentry' || ticket.kind === 'inside';
}

export interface DevicePassIndexData {
  passes: DevicePassEntry[];
  /** Legacy bindings this request proved, to migrate to the pass-scoped cookie. */
  reissues: PassGrant[];
}

/**
 * The passes this device can prove it holds. Each pass is found by the hash of
 * the link token stored in its cookie, then filtered by the device binding the
 * same request presents. A pass that cannot be proven never enters the list.
 */
export async function listDevicePasses(
  links: PassLinkBinding[],
  bindings: PassDeviceBinding[],
): Promise<PassResult<DevicePassIndexData>> {
  if (!config.features.dynamicQrEnabled) return { ok: false, code: 'dynamic_qr_disabled' };

  const tokenByHash = new Map<string, string>();
  for (const link of links) tokenByHash.set(sha256Hex(link.linkToken), link.linkToken);

  if (tokenByHash.size === 0) return { ok: true, data: { passes: [], reissues: [] } };

  const rows = await db
    .select({
      pass: accessPasses,
      communityName: communities.name,
      timezone: communities.timezone,
      dynamicQrEnabled: communities.dynamicQrEnabled,
    })
    .from(accessPasses)
    .innerJoin(communities, eq(accessPasses.communityId, communities.id))
    .where(inArray(accessPasses.linkTokenHash, [...tokenByHash.keys()]));

  const now = new Date();
  const passes: DevicePassEntry[] = [];
  const reissues: PassGrant[] = [];

  for (const row of rows) {
    const found: FoundPass = row;
    // A community that turned the dynamic QR off does not show its passes here.
    if (!found.dynamicQrEnabled) continue;
    // The binding must be proven by this very request, not remembered by the server.
    if (!isBound(found, bindings)) continue;

    const token = tokenByHash.get(found.pass.linkTokenHash);
    if (!token) continue;

    const [locationPath, rule] = await Promise.all([
      buildLocationPath(found.pass.locationUnitId),
      buildPassRule(found.pass, found.timezone, now),
    ]);

    const ticket = passTicketState({
      type: found.pass.type,
      status: found.pass.status,
      presenceState: found.pass.presenceState,
      recurrence: found.pass.recurrence,
      maxUses: found.pass.maxUses,
      exitCount: found.pass.exitCount,
      validUntil: found.pass.validUntil,
      rule,
    });

    const linkAlive = found.pass.linkExpiresAt.getTime() >= now.getTime();

    passes.push({
      passId: found.pass.id,
      token,
      communityName: found.communityName,
      visitorFirstName: found.pass.visitorFirstName,
      locationPath: locationPath ?? '',
      ticket,
      actionable: linkAlive && isActionableTicket(ticket),
    });

    const grant = grantFor(found, bindings);
    if (grant.legacyCookie) reissues.push(grant);
  }

  passes.sort((a, b) => {
    if (a.actionable !== b.actionable) return a.actionable ? -1 : 1;
    return a.locationPath.localeCompare(b.locationPath, 'es');
  });

  return { ok: true, data: { passes, reissues } };
}
