import bcrypt from 'bcryptjs';
import { and, desc, eq, gte, ilike, inArray, lt, lte, or, sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { createDb } from '@porteria/database';
import { accessPasses, communities, memberships } from '@porteria/database/schema';
import {
  PassStatus,
  PassType,
  createEventEnvelope,
  type CreatePassDto,
  type DestinationOption,
  type DestinationSummary,
  type PassBatchCreated,
  type PassBatchRejection,
  type PassBatchRequest,
  type PassBatchResult,
  type PassBatchPreview,
  type PassBatchVisitorInput,
  type PassLinkResponse,
  type PassQrResponse,
} from '@porteria/shared';
import config from '../config.js';
import { decryptLinkToken, encryptLinkToken, randomToken, sha256Hex } from '../lib/pass-tokens.js';
import { buildLocationPath } from './location-path.service.js';
import {
  isAuthorizableCommonArea,
  listAuthorizableDestinations,
  loadCommunityTree,
  resolveDestinationById,
  resolveDestinationFromTree,
  type CommunityTree,
  type ResolvedDestination,
} from './pass-destination.service.js';
import { enqueueEventDefault } from './outbox.service.js';
import { publishPassEvent } from '../lib/pass-bus.js';
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

/** Person behind the session. The pass stream uses it to route events. */
export function personIdForRequester(requester: PassRequester) {
  return resolvePersonId(requester);
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

  const destinationResult = await resolveDestinationForRequester(
    requester,
    personId,
    input.locationUnitId,
  );
  if (!destinationResult.ok) return destinationResult;
  const destination = destinationResult.data;

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

  /**
   * The daily limit is a rule of the community, not a global setting: each
   * administration decides if it exists and how high it is.
   * `PASS_DAILY_LIMIT_PER_UNIT=0` stays as an emergency switch that turns the rule
   * off everywhere, without touching the stored numbers.
   */
  const [communityRule] = await db
    .select({
      timezone: communities.timezone,
      limitEnabled: communities.passDailyLimitEnabled,
      limit: communities.passDailyLimit,
    })
    .from(communities)
    .where(eq(communities.id, requester.communityId))
    .limit(1);

  const limitEnabled = config.passes.dailyLimitPerUnit > 0 && (communityRule?.limitEnabled ?? true);

  if (limitEnabled) {
    const timezone = communityRule?.timezone || 'UTC';
    const max = communityRule?.limit ?? config.passes.dailyLimitPerUnit;
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

    if ((today?.count ?? 0) >= max) {
      return { ok: false, code: 'daily_limit_reached', max };
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
      structureId: destination.structureId,
      createdByPersonId: personId,
      authorizedByPersonId: personId,
      visitorFirstName: input.visitorFirstName.trim(),
      visitorLastName: input.visitorLastName.trim(),
      visitorDocument: input.visitorDocument.trim(),
      hasVehicle: input.hasVehicle ?? false,
      vehiclePlate:
        input.hasVehicle && input.vehiclePlate ? input.vehiclePlate.trim().toUpperCase() : null,
      type: input.type,
      maxUses: input.type === 'entry_only' ? 1 : (input.maxUses ?? 1),
      validFrom,
      validUntil,
      allowedDays: null,
      timeFrom: input.timeFrom ?? null,
      timeTo: input.timeTo ?? null,
      linkTokenHash: sha256Hex(linkToken),
      linkTokenEncrypted: encryptLinkToken(linkToken, config.passes.qrSecret),
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

async function resolveDestinationForRequester(
  requester: PassRequester,
  personId: string,
  locationUnitId: string,
): Promise<PassResult<ResolvedDestination>> {
  if (!requester.communityId) return { ok: false, code: 'forbidden' };

  const tree = await loadCommunityTree(requester.communityId);
  const destination = resolveDestinationFromTree(tree, locationUnitId);
  if (!destination) return { ok: false, code: 'not_found' };
  if (!destination.active) return { ok: false, code: 'destination_inactive' };

  if (destination.kind === 'common_area') {
    // A common-area root that still has children is a container, not a place.
    if (!isAuthorizableCommonArea(destination)) return { ok: false, code: 'invalid' };
    return { ok: true, data: destination };
  }

  if (destination.levelPosition !== destination.levelCount) {
    return { ok: false, code: 'invalid' };
  }

  const [membership] = await db
    .select({ id: memberships.id })
    .from(memberships)
    .where(
      and(
        eq(memberships.personId, personId),
        eq(memberships.locationUnitId, locationUnitId),
        eq(memberships.status, 'active'),
      ),
    )
    .limit(1);

  if (!membership) return { ok: false, code: 'forbidden' };

  return { ok: true, data: destination };
}

export async function listDestinations(
  requester: PassRequester,
): Promise<PassResult<DestinationSummary[]>> {
  const personId = await resolvePersonId(requester);
  if (!personId) return { ok: false, code: 'forbidden' };
  if (!requester.communityId) return { ok: false, code: 'forbidden' };

  return {
    ok: true,
    data: await listAuthorizableDestinations(personId, requester.communityId),
  };
}

/**
 * Destinations that appear in the resident's own history, including places that
 * were archived after they received passes. Without this the history filter
 * could not reach those rows any more.
 */
export async function listHistoryDestinations(
  requester: PassRequester,
): Promise<PassResult<DestinationOption[]>> {
  const personId = await resolvePersonId(requester);
  if (!personId) return { ok: false, code: 'forbidden' };

  const rows = await db
    .selectDistinct({
      locationUnitId: accessPasses.locationUnitId,
      communityId: accessPasses.communityId,
    })
    .from(accessPasses)
    .where(eq(accessPasses.createdByPersonId, personId));

  const trees = new Map<string, CommunityTree>();
  await Promise.all(
    [...new Set(rows.map((row) => row.communityId))].map(async (communityId) => {
      trees.set(communityId, await loadCommunityTree(communityId));
    }),
  );

  const options = new Map<string, DestinationOption>();
  for (const row of rows) {
    if (options.has(row.locationUnitId)) continue;
    const tree = trees.get(row.communityId);
    const destination = tree ? resolveDestinationFromTree(tree, row.locationUnitId) : null;
    if (!destination) continue;
    options.set(row.locationUnitId, {
      ...toDestinationSummary(destination),
      active: destination.active,
    });
  }

  return {
    ok: true,
    data: [...options.values()].sort((left, right) => left.path.localeCompare(right.path, 'es')),
  };
}

export const PASS_BATCH_MAX_VISITORS = 200;

function parseWindow(rawFrom: string, rawUntil: string) {
  const validFrom = new Date(rawFrom);
  const validUntil = new Date(rawUntil);
  if (
    Number.isNaN(validFrom.getTime()) ||
    Number.isNaN(validUntil.getTime()) ||
    validFrom.getTime() >= validUntil.getTime()
  ) {
    return null;
  }
  return { validFrom, validUntil };
}

function rejectVisitor(visitor: PassBatchVisitorInput, reason: string): PassBatchRejection {
  return {
    document: visitor.document,
    visitorFirstName: visitor.firstName.trim(),
    visitorLastName: visitor.lastName.trim(),
    reason,
  };
}

interface PreparedBatch {
  personId: string;
  communityId: string;
  destination: ResolvedDestination;
  window: { validFrom: Date; validUntil: Date };
  batchId: string;
  batchLabel: string | null;
  valid: PassBatchVisitorInput[];
  rejected: PassBatchRejection[];
}

/**
 * Validates a batch and splits it into what can be created and what cannot.
 * The preview and the real insert share this so both report the same reasons.
 */
async function prepareBatch(
  requester: PassRequester,
  input: PassBatchRequest,
): Promise<PassResult<PreparedBatch>> {
  if (!config.features.dynamicQrEnabled) return { ok: false, code: 'dynamic_qr_disabled' };
  if (!requester.communityId) return { ok: false, code: 'forbidden' };
  if (input.type === PassType.EntryExitRecurring) {
    return { ok: false, code: 'recurring_not_available' };
  }
  if (input.visitors.length > PASS_BATCH_MAX_VISITORS) {
    return { ok: false, code: 'batch_too_large' };
  }

  const personId = await resolvePersonId(requester);
  if (!personId) return { ok: false, code: 'forbidden' };

  const destinationResult = await resolveDestinationForRequester(
    requester,
    personId,
    input.destination,
  );
  if (!destinationResult.ok) return destinationResult;
  const destination = destinationResult.data;

  const window = parseWindow(input.validFrom, input.validUntil);
  if (!window) return { ok: false, code: 'invalid' };

  const batchLabel = input.batchLabel?.trim() || null;
  const rejected: PassBatchRejection[] = [];
  const seenDocuments = new Set<string>();
  const candidates: PassBatchVisitorInput[] = [];

  for (const visitor of input.visitors) {
    const document = visitor.document.trim();
    const duplicated = seenDocuments.has(document);
    seenDocuments.add(document);
    if (duplicated) {
      rejected.push(rejectVisitor({ ...visitor, document }, 'documento duplicado en el archivo'));
      continue;
    }
    candidates.push({ ...visitor, document });
  }

  const existing = candidates.length
    ? await db
        .select({ document: accessPasses.visitorDocument })
        .from(accessPasses)
        .where(
          and(
            eq(accessPasses.communityId, requester.communityId),
            eq(accessPasses.locationUnitId, destination.id),
            eq(accessPasses.status, PassStatus.Active),
            inArray(
              accessPasses.visitorDocument,
              candidates.map((visitor) => visitor.document),
            ),
            gte(accessPasses.validUntil, window.validFrom),
            lte(accessPasses.validFrom, window.validUntil),
          ),
        )
    : [];
  const alreadyAuthorized = new Set(existing.map((row) => row.document));

  const valid: PassBatchVisitorInput[] = [];
  for (const visitor of candidates) {
    if (alreadyAuthorized.has(visitor.document)) {
      rejected.push(rejectVisitor(visitor, 'ya tiene una autorización activa para ese destino'));
      continue;
    }
    valid.push(visitor);
  }

  return {
    ok: true,
    data: {
      personId,
      communityId: requester.communityId,
      destination,
      window,
      batchId: randomUUID(),
      batchLabel,
      valid,
      rejected,
    },
  };
}

/** Dry run of a batch: same rules, no insert. */
export async function previewPassBatch(
  requester: PassRequester,
  input: PassBatchRequest,
): Promise<PassResult<PassBatchPreview>> {
  const prepared = await prepareBatch(requester, input);
  if (!prepared.ok) return prepared;

  const { batchLabel, valid, rejected } = prepared.data;
  return {
    ok: true,
    data: {
      batchLabel,
      total: valid.length + rejected.length,
      validCount: valid.length,
      rejected,
    },
  };
}

export async function createPassBatch(
  requester: PassRequester,
  input: PassBatchRequest,
): Promise<PassResult<PassBatchResult>> {
  const prepared = await prepareBatch(requester, input);
  if (!prepared.ok) return prepared;
  const { personId, communityId, destination, window, batchId, batchLabel, valid, rejected } =
    prepared.data;

  const created: PassBatchCreated[] = [];

  if (valid.length > 0) {
    // A batch is one logical operation: every pass lands or none does.
    await db.transaction(async (tx) => {
      for (const visitor of valid) {
        const passId = randomUUID();
        const linkToken = randomToken(32);
        const linkExpiresAt = new Date(
          Math.min(Date.now() + config.passes.linkTtlMinutes * 60_000, window.validUntil.getTime()),
        );
        const plate = visitor.vehiclePlate?.trim().toUpperCase() ?? '';

        const [inserted] = await tx
          .insert(accessPasses)
          .values({
            id: passId,
            communityId,
            locationUnitId: destination.id,
            structureId: destination.structureId,
            createdByPersonId: personId,
            authorizedByPersonId: personId,
            visitorFirstName: visitor.firstName.trim(),
            visitorLastName: visitor.lastName.trim(),
            visitorDocument: visitor.document,
            hasVehicle: plate.length > 0,
            vehiclePlate: plate.length > 0 ? plate : null,
            type: input.type,
            maxUses: input.type === 'entry_only' ? 1 : (input.maxUses ?? 1),
            validFrom: window.validFrom,
            validUntil: window.validUntil,
            allowedDays: null,
            linkTokenHash: sha256Hex(linkToken),
            linkTokenEncrypted: encryptLinkToken(linkToken, config.passes.qrSecret),
            linkExpiresAt,
            pinHash: null,
            pinEnabled: false,
            batchId,
            batchLabel,
          })
          .returning({
            id: accessPasses.id,
            visitorFirstName: accessPasses.visitorFirstName,
            visitorLastName: accessPasses.visitorLastName,
            visitorDocument: accessPasses.visitorDocument,
            vehiclePlate: accessPasses.vehiclePlate,
          });

        created.push({
          id: inserted.id,
          visitorFirstName: inserted.visitorFirstName,
          visitorLastName: inserted.visitorLastName,
          visitorDocument: inserted.visitorDocument,
          vehiclePlate: inserted.vehiclePlate,
        });
      }
    });

    // One event for the whole batch keeps the outbox readable.
    await enqueuePassEvent(requester, 'pass.created', communityId, {
      batchId,
      batchLabel,
      locationUnitId: destination.id,
      type: input.type,
      count: created.length,
    });
  }

  return {
    ok: true,
    data: {
      batchId,
      batchLabel,
      createdCount: created.length,
      rejectedCount: rejected.length,
      created,
      rejected,
    },
  };
}

export interface PassListQuery {
  status?: PassStatus;
  search?: string;
  destinationUnitId?: string;
  batchId?: string;
  page: number;
  pageSize: number;
}

export type PassListItem = Omit<AccessPassRow, 'linkTokenEncrypted'> & {
  locationPath: string;
  destination: DestinationSummary;
  shareUrl: string | null;
};

/** The encrypted copy is for the server only: never send it to a client. */
function toPassItem(pass: AccessPassRow): Omit<AccessPassRow, 'linkTokenEncrypted'> {
  const { linkTokenEncrypted: _encrypted, ...rest } = pass;
  return rest;
}

/**
 * Rebuilds the public link so the resident can share it again from the history.
 * Null when the row predates the encrypted copy or the link already expired:
 * the UI disables the copy action instead of handing out a dead link.
 */
function shareUrlFor(pass: AccessPassRow): string | null {
  if (pass.linkExpiresAt.getTime() <= Date.now()) return null;
  if (!pass.linkTokenEncrypted) return null;
  const token = decryptLinkToken(pass.linkTokenEncrypted, config.passes.qrSecret);
  return token ? `${config.passes.passWebUrl}/p/${token}` : null;
}

function toDestinationSummary(destination: ResolvedDestination): DestinationSummary {
  return {
    id: destination.id,
    name: destination.name,
    path: destination.path,
    kind: destination.kind,
  };
}

export async function listPasses(
  requester: PassRequester,
  query: PassListQuery,
): Promise<PassResult<{ items: PassListItem[]; total: number }>> {
  const personId = await resolvePersonId(requester);
  if (!personId) return { ok: false, code: 'forbidden' };

  const conditions = [eq(accessPasses.createdByPersonId, personId)];
  if (query.status === PassStatus.Expired) {
    // The UI shows "Vencida" for any active pass past its window, so the filter
    // must return the same rows the badge labels that way.
    conditions.push(
      or(
        eq(accessPasses.status, PassStatus.Expired),
        and(eq(accessPasses.status, PassStatus.Active), lt(accessPasses.validUntil, new Date())),
      ) as ReturnType<typeof eq>,
    );
  } else if (query.status === PassStatus.Active) {
    conditions.push(eq(accessPasses.status, PassStatus.Active));
    conditions.push(gte(accessPasses.validUntil, new Date()));
  } else if (query.status) {
    conditions.push(eq(accessPasses.status, query.status));
  }
  if (query.destinationUnitId) {
    conditions.push(eq(accessPasses.locationUnitId, query.destinationUnitId));
  }
  if (query.batchId) conditions.push(eq(accessPasses.batchId, query.batchId));

  const search = query.search?.trim();
  if (search) {
    const escaped = search.replace(/[%_\\]/g, (match) => `\\${match}`);
    const pattern = `%${escaped}%`;
    conditions.push(
      or(
        ilike(accessPasses.visitorFirstName, pattern),
        ilike(accessPasses.visitorLastName, pattern),
        ilike(accessPasses.visitorDocument, pattern),
      ) as ReturnType<typeof eq>,
    );
  }

  const where = and(...conditions);

  const [totals] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(accessPasses)
    .where(where);

  const rows = await db
    .select()
    .from(accessPasses)
    .where(where)
    .orderBy(desc(accessPasses.validFrom))
    .limit(query.pageSize)
    .offset((query.page - 1) * query.pageSize);

  const trees = new Map<string, CommunityTree>();
  await Promise.all(
    [...new Set(rows.map((row) => row.communityId))].map(async (communityId) => {
      trees.set(communityId, await loadCommunityTree(communityId));
    }),
  );

  const items: PassListItem[] = [];
  for (const pass of rows) {
    const tree = trees.get(pass.communityId);
    const destination = tree ? resolveDestinationFromTree(tree, pass.locationUnitId) : null;
    if (destination) {
      items.push({
        ...toPassItem(pass),
        locationPath: destination.path,
        destination: toDestinationSummary(destination),
        shareUrl: shareUrlFor(pass),
      });
      continue;
    }
    // Defensive fallback: the row stays readable even if the node vanished.
    items.push({
      ...toPassItem(pass),
      locationPath: (await buildLocationPath(pass.locationUnitId)) ?? '',
      destination: {
        id: pass.locationUnitId,
        name: '',
        path: '',
        kind: 'home',
      },
      shareUrl: shareUrlFor(pass),
    });
  }

  return { ok: true, data: { items, total: totals?.count ?? 0 } };
}

export async function getPassById(
  requester: PassRequester,
  passId: string,
): Promise<PassResult<PassListItem>> {
  const owned = await findOwnedPass(requester, passId);
  if (!owned.ok) return owned;

  const destination = await resolveDestinationById(owned.data.locationUnitId);

  return {
    ok: true,
    data: {
      ...toPassItem(owned.data),
      locationPath: destination?.path ?? (await buildLocationPath(owned.data.locationUnitId)) ?? '',
      destination: destination
        ? toDestinationSummary(destination)
        : { id: owned.data.locationUnitId, name: '', path: '', kind: 'home' },
      shareUrl: shareUrlFor(owned.data),
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

  // Notify the owner so a second tab or another device drops the pass at once.
  if (owned.data.createdByPersonId) {
    publishPassEvent({
      personId: owned.data.createdByPersonId,
      passId,
      status: PassStatus.Revoked,
    });
  }

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
      linkTokenEncrypted: encryptLinkToken(token, config.passes.qrSecret),
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
