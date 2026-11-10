import bcrypt from 'bcryptjs';
import { and, desc, eq, gte, sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { createDb } from '@porteria/database';
import { accessPasses, communities, locationUnits, memberships } from '@porteria/database/schema';
import {
  PassStatus,
  PassType,
  createEventEnvelope,
  type CreatePassDto,
  type PassLinkResponse,
  type PassQrResponse,
} from '@porteria/shared';
import config from '../config.js';
import { randomToken, sha256Hex } from '../lib/pass-tokens.js';
import { buildLocationPath } from './location-path.service.js';
import { validateLocationUnit } from './location-unit.service.js';
import { enqueueEventDefault } from './outbox.service.js';
import { signPassQrToken } from './pass-qr-token.service.js';
import type { PassResult } from './pass-errors.js';

const db = createDb();

type AccessPassRow = typeof accessPasses.$inferSelect;

export interface PassRequester {
  sub: string;
  accountId?: string;
  personId?: string;
  role: string;
  orgId: string;
  communityId: string | null;
  membershipId: string;
  isPlatformAdmin: boolean;
}

async function resolvePersonId(requester: PassRequester): Promise<string | null> {
  if (requester.personId) return requester.personId;
  if (!requester.membershipId || requester.membershipId === 'platform') return null;

  const [row] = await db
    .select({ personId: memberships.personId })
    .from(memberships)
    .where(eq(memberships.id, requester.membershipId))
    .limit(1);

  return row?.personId ?? null;
}

async function findOwnedPass(
  requester: PassRequester,
  passId: string,
): Promise<PassResult<AccessPassRow>> {
  const personId = await resolvePersonId(requester);
  if (!personId) return { ok: false, code: 'forbidden' };

  const [pass] = await db.select().from(accessPasses).where(eq(accessPasses.id, passId)).limit(1);

  if (!pass) return { ok: false, code: 'not_found' };
  if (pass.createdByPersonId !== personId && pass.authorizedByPersonId !== personId) {
    return { ok: false, code: 'forbidden' };
  }

  return { ok: true, data: pass };
}

async function enqueuePassEvent(
  requester: PassRequester,
  eventType: string,
  communityId: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const personId = await resolvePersonId(requester);
  await enqueueEventDefault(
    createEventEnvelope({
      eventType,
      organizationId: requester.orgId,
      communityId,
      actorId: personId,
      actorRole: requester.role,
      payload,
    }),
  ).catch(() => undefined);
}

export async function createPass(
  requester: PassRequester,
  input: CreatePassDto,
): Promise<PassResult<PassLinkResponse>> {
  if (!config.features.dynamicQrEnabled) return { ok: false, code: 'dynamic_qr_disabled' };
  if (!requester.communityId) return { ok: false, code: 'forbidden' };
  if (input.type === PassType.EntryExitRecurring) {
    return { ok: false, code: 'recurring_not_available' };
  }
  if (input.allowedDays && input.allowedDays.length > 0) {
    return { ok: false, code: 'allowed_days_reserved' };
  }

  const personId = await resolvePersonId(requester);
  if (!personId) return { ok: false, code: 'forbidden' };

  const [membership] = await db
    .select({ id: memberships.id })
    .from(memberships)
    .where(
      and(
        eq(memberships.id, requester.membershipId),
        eq(memberships.personId, personId),
        eq(memberships.locationUnitId, input.locationUnitId),
        eq(memberships.status, 'active'),
      ),
    )
    .limit(1);

  if (!membership) return { ok: false, code: 'forbidden' };

  const validation = await validateLocationUnit(input.locationUnitId, requester.communityId);
  if (!validation.ok) {
    return { ok: false, code: validation.code === 'not_leaf' ? 'invalid' : 'not_found' };
  }

  const [unit] = await db
    .select({ structureId: locationUnits.structureId })
    .from(locationUnits)
    .where(eq(locationUnits.id, input.locationUnitId))
    .limit(1);

  if (!unit) return { ok: false, code: 'not_found' };

  const validFrom = new Date(input.validFrom);
  const validUntil = new Date(input.validUntil);
  if (
    Number.isNaN(validFrom.getTime()) ||
    Number.isNaN(validUntil.getTime()) ||
    validFrom.getTime() >= validUntil.getTime()
  ) {
    return { ok: false, code: 'invalid' };
  }

  if ((input.timeFrom && !input.timeTo) || (!input.timeFrom && input.timeTo)) {
    return { ok: false, code: 'invalid' };
  }
  if (input.timeFrom && input.timeTo && input.timeFrom >= input.timeTo) {
    return { ok: false, code: 'invalid' };
  }

  if (input.hasVehicle && !input.vehiclePlate?.trim()) {
    return { ok: false, code: 'invalid' };
  }
  if (input.pin && !/^\d{4}$/.test(input.pin)) {
    return { ok: false, code: 'invalid' };
  }

  if (config.passes.dailyLimitPerUnit > 0) {
    const [community] = await db
      .select({ timezone: communities.timezone })
      .from(communities)
      .where(eq(communities.id, requester.communityId))
      .limit(1);
    const timezone = community?.timezone || 'UTC';
    const [today] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(accessPasses)
      .where(
        and(
          eq(accessPasses.communityId, requester.communityId),
          eq(accessPasses.locationUnitId, input.locationUnitId),
          gte(
            accessPasses.createdAt,
            sql`date_trunc('day', now() AT TIME ZONE ${timezone}) AT TIME ZONE ${timezone}`,
          ),
        ),
      );

    if ((today?.count ?? 0) >= config.passes.dailyLimitPerUnit) {
      return { ok: false, code: 'daily_limit_reached' };
    }
  }

  const passId = randomUUID();
  const linkToken = randomToken(32);
  const linkExpiresAt = new Date(
    Math.min(Date.now() + config.passes.linkTtlMinutes * 60_000, validUntil.getTime()),
  );
  const pinHash = input.pin ? await bcrypt.hash(input.pin, 10) : null;

  const [inserted] = await db
    .insert(accessPasses)
    .values({
      id: passId,
      communityId: requester.communityId,
      locationUnitId: input.locationUnitId,
      structureId: unit.structureId,
      createdByPersonId: personId,
      authorizedByPersonId: personId,
      visitorFirstName: input.visitorFirstName.trim(),
      visitorLastName: input.visitorLastName.trim(),
      visitorDocument: input.visitorDocument.trim(),
      hasVehicle: input.hasVehicle ?? false,
      vehiclePlate:
        input.hasVehicle && input.vehiclePlate ? input.vehiclePlate.trim().toUpperCase() : null,
      type: input.type,
      validFrom,
      validUntil,
      allowedDays: null,
      timeFrom: input.timeFrom ?? null,
      timeTo: input.timeTo ?? null,
      linkTokenHash: sha256Hex(linkToken),
      linkExpiresAt,
      pinHash,
      pinEnabled: Boolean(input.pin),
    })
    .returning();

  if (!inserted) return { ok: false, code: 'invalid' };

  await enqueuePassEvent(requester, 'pass.created', requester.communityId, {
    passId,
    locationUnitId: input.locationUnitId,
    type: input.type,
  });

  const qr = signPassQrToken(passId);

  return {
    ok: true,
    data: {
      pass: inserted,
      shareUrl: `${config.passes.passWebUrl}/p/${linkToken}`,
      qrToken: qr.token,
      qrExpiresAt: qr.expiresAt.toISOString(),
    },
  };
}

export async function listPasses(
  requester: PassRequester,
  query: { status?: PassStatus; page: number; pageSize: number },
): Promise<PassResult<Array<AccessPassRow & { locationPath: string }>>> {
  const personId = await resolvePersonId(requester);
  if (!personId) return { ok: false, code: 'forbidden' };

  const conditions = [eq(accessPasses.createdByPersonId, personId)];
  if (query.status) conditions.push(eq(accessPasses.status, query.status));

  const rows = await db
    .select()
    .from(accessPasses)
    .where(and(...conditions))
    .orderBy(desc(accessPasses.createdAt))
    .limit(query.pageSize)
    .offset((query.page - 1) * query.pageSize);

  const data = await Promise.all(
    rows.map(async (pass) => ({
      ...pass,
      locationPath: (await buildLocationPath(pass.locationUnitId)) ?? '',
    })),
  );

  return { ok: true, data };
}

export async function getPassById(
  requester: PassRequester,
  passId: string,
): Promise<PassResult<AccessPassRow & { locationPath: string }>> {
  const owned = await findOwnedPass(requester, passId);
  if (!owned.ok) return owned;

  return {
    ok: true,
    data: {
      ...owned.data,
      locationPath: (await buildLocationPath(owned.data.locationUnitId)) ?? '',
    },
  };
}

export async function revokePass(
  requester: PassRequester,
  passId: string,
): Promise<PassResult<{ id: string; status: PassStatus }>> {
  const owned = await findOwnedPass(requester, passId);
  if (!owned.ok) return owned;
  if (owned.data.status !== PassStatus.Active) return { ok: false, code: 'conflict' };

  await db
    .update(accessPasses)
    .set({ status: PassStatus.Revoked, updatedAt: new Date() })
    .where(eq(accessPasses.id, passId));

  await enqueuePassEvent(requester, 'pass.revoked', owned.data.communityId, { passId });

  return { ok: true, data: { id: passId, status: PassStatus.Revoked } };
}

export async function regenerateLink(
  requester: PassRequester,
  passId: string,
): Promise<PassResult<{ shareUrl: string; linkExpiresAt: string }>> {
  const owned = await findOwnedPass(requester, passId);
  if (!owned.ok) return owned;
  if (owned.data.status !== PassStatus.Active) return { ok: false, code: 'conflict' };

  const token = randomToken(32);
  const linkExpiresAt = new Date(
    Math.min(Date.now() + config.passes.linkTtlMinutes * 60_000, owned.data.validUntil.getTime()),
  );

  await db
    .update(accessPasses)
    .set({
      linkTokenHash: sha256Hex(token),
      deviceKeyHash: null,
      boundAt: null,
      linkExpiresAt,
      pinFailedAttempts: 0,
      pinLockedUntil: null,
      updatedAt: new Date(),
    })
    .where(eq(accessPasses.id, passId));

  await enqueuePassEvent(requester, 'pass.link_regenerated', owned.data.communityId, { passId });

  return {
    ok: true,
    data: {
      shareUrl: `${config.passes.passWebUrl}/p/${token}`,
      linkExpiresAt: linkExpiresAt.toISOString(),
    },
  };
}

export async function getResidentQr(
  requester: PassRequester,
  passId: string,
): Promise<PassResult<PassQrResponse>> {
  const owned = await findOwnedPass(requester, passId);
  if (!owned.ok) return owned;
  if (owned.data.status === PassStatus.Used) return { ok: false, code: 'pass_used' };
  if (owned.data.status !== PassStatus.Active) return { ok: false, code: 'gone' };
  if (owned.data.linkExpiresAt.getTime() < Date.now()) {
    return { ok: false, code: 'link_expired' };
  }

  const qr = signPassQrToken(passId);
  return { ok: true, data: { token: qr.token, expiresAt: qr.expiresAt.toISOString() } };
}
