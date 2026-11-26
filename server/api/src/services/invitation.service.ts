import { and, desc, eq, inArray, isNull, ne } from 'drizzle-orm';
import crypto from 'crypto';
import { hashPassword } from './credentials.service.js';
import { createDb } from '@porteria/database';
import {
  invitations,
  invitationUnits,
  accounts,
  people,
  memberships,
  locationResidents,
  communities,
  units,
  locationUnits,
} from '@porteria/database/schema';
import type { MembershipRole, PublicInvitationPreview } from '@porteria/shared';
import config from '../config.js';
import { validateMembershipScope } from './memberships.service.js';
import { validateLocationUnit } from './location-unit.service.js';
import { sendInvitationEmail } from './mail.service.js';
import * as authService from './auth.service.js';

const db = createDb();

function otherOrgAdminsCondition(organizationId: string, keepMembershipId: string) {
  return and(
    eq(memberships.organizationId, organizationId),
    eq(memberships.role, 'org_admin'),
    eq(memberships.status, 'active'),
    ne(memberships.id, keepMembershipId),
  );
}

export interface InvitationRequester {
  sub: string;
  personId: string | null;
  role: string;
  orgId: string;
  communityId: string | null;
  isPlatformAdmin: boolean;
}

export interface CreateInvitationInput {
  email: string;
  role: MembershipRole;
  organizationId?: string;
  communityId?: string | null;
  unitId?: string | null;
  locationUnitId?: string | null;
  locationUnitIds?: string[];
  expiresInDays?: number;
}

export type InvitationErrorCode =
  | 'not_found'
  | 'forbidden'
  | 'invalid_payload'
  | 'conflict'
  | 'already_member'
  | 'unit_invalid'
  | 'too_many_units'
  | 'login_required'
  | 'email_mismatch'
  | 'gone';

export type InvitationResult<T> = { ok: true; data: T } | { ok: false; code: InvitationErrorCode };

export interface InvitationDelivery {
  invitation: typeof invitations.$inferSelect;
  acceptUrl: string;
  emailSent: boolean;
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return '***';
  const visible = local.slice(0, 2);
  return `${visible}${'*'.repeat(Math.max(1, local.length - 2))}@${domain}`;
}

function buildAcceptUrl(token: string): string {
  return `${config.publicAppUrl}/invite/${token}`;
}

async function communityNameFor(communityId: string | null): Promise<string | null> {
  if (!communityId) return null;
  const [row] = await db
    .select({ name: communities.name })
    .from(communities)
    .where(eq(communities.id, communityId))
    .limit(1);
  return row?.name ?? null;
}

async function deliverInvitationEmail(input: {
  invitationId: string;
  to: string;
  acceptUrl: string;
  role: string;
  expiresAt: Date;
  communityName: string | null;
}): Promise<boolean> {
  try {
    const result = await sendInvitationEmail({
      to: input.to,
      acceptUrl: input.acceptUrl,
      role: input.role,
      expiresAt: input.expiresAt,
      communityName: input.communityName,
    });

    if (!result.sent) {
      console.warn('[invitations] Invitation email was not sent', {
        invitationId: input.invitationId,
        reason: result.reason,
      });
    }

    return result.sent;
  } catch (err) {
    console.error('[invitations] Invitation email failed unexpectedly', {
      invitationId: input.invitationId,
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}

function expiryDate(days?: number): Date {
  const validDays = days && days > 0 ? days : config.invitationExpiryDays;
  return new Date(Date.now() + validDays * 24 * 60 * 60 * 1000);
}

function resolveScope(data: CreateInvitationInput, requester: InvitationRequester) {
  const organizationId = requester.isPlatformAdmin ? data.organizationId : requester.orgId;

  if (!organizationId) {
    return { error: 'organizationId is required' as const };
  }

  if (
    !requester.isPlatformAdmin &&
    data.organizationId &&
    data.organizationId !== requester.orgId
  ) {
    return { error: 'organization out of scope' as const };
  }

  const communityId =
    requester.role === 'community_admin' ? requester.communityId : (data.communityId ?? null);

  if (
    requester.role === 'community_admin' &&
    data.communityId &&
    data.communityId !== requester.communityId
  ) {
    return { error: 'community out of scope' as const };
  }

  const locationUnitId = data.locationUnitId ?? data.unitId ?? data.locationUnitIds?.[0] ?? null;
  const scopeError = validateMembershipScope(data.role, communityId, locationUnitId);
  if (scopeError) return { error: scopeError };

  return {
    organizationId,
    communityId,
    unitId: data.unitId ?? null,
    locationUnitId: data.locationUnitId ?? data.locationUnitIds?.[0] ?? null,
  };
}

function canManage(invitation: typeof invitations.$inferSelect, requester: InvitationRequester) {
  if (requester.isPlatformAdmin) return true;
  if (requester.role === 'org_admin') return invitation.organizationId === requester.orgId;
  if (requester.role === 'community_admin') {
    return (
      invitation.organizationId === requester.orgId &&
      invitation.communityId === requester.communityId
    );
  }
  return false;
}

async function findMembership(
  personId: string,
  organizationId: string,
  communityId: string | null,
  unitId: string | null,
  role: string,
  locationUnitId: string | null = null,
) {
  const conditions = [
    eq(memberships.personId, personId),
    eq(memberships.organizationId, organizationId),
    eq(memberships.role, role as MembershipRole),
    eq(memberships.status, 'active'),
  ];
  conditions.push(
    communityId ? eq(memberships.communityId, communityId) : isNull(memberships.communityId),
  );
  conditions.push(unitId ? eq(memberships.unitId, unitId) : isNull(memberships.unitId));
  conditions.push(
    locationUnitId
      ? eq(memberships.locationUnitId, locationUnitId)
      : isNull(memberships.locationUnitId),
  );

  const [membership] = await db
    .select()
    .from(memberships)
    .where(and(...conditions))
    .limit(1);
  return membership ?? null;
}

const MAX_INVITATION_UNITS = 50;

async function resolveInvitationUnitIds(
  data: CreateInvitationInput,
  scope: { communityId: string | null; locationUnitId: string | null },
): Promise<InvitationResult<string[]>> {
  const requested = data.locationUnitIds?.length
    ? data.locationUnitIds
    : scope.locationUnitId
      ? [scope.locationUnitId]
      : [];
  const unitIds = [...new Set(requested)];

  if (unitIds.length > MAX_INVITATION_UNITS) {
    return { ok: false, code: 'too_many_units' };
  }

  if (unitIds.length === 0) {
    return { ok: true, data: [] };
  }

  if (!scope.communityId) {
    return { ok: false, code: 'unit_invalid' };
  }

  for (const unitId of unitIds) {
    const unit = await validateLocationUnit(unitId, scope.communityId);
    if (!unit.ok) {
      return { ok: false, code: 'unit_invalid' };
    }
  }

  return { ok: true, data: unitIds };
}

export async function createInvitation(
  data: CreateInvitationInput,
  requester: InvitationRequester,
): Promise<InvitationResult<InvitationDelivery>> {
  if (
    !requester.isPlatformAdmin &&
    requester.role !== 'org_admin' &&
    requester.role !== 'community_admin'
  ) {
    return { ok: false, code: 'forbidden' };
  }

  const scope = resolveScope(data, requester);
  if ('error' in scope) {
    return { ok: false, code: 'invalid_payload' };
  }

  const unitsResult = await resolveInvitationUnitIds(data, scope);
  if (!unitsResult.ok) {
    return { ok: false, code: unitsResult.code };
  }
  const unitIds = unitsResult.data;

  if (data.role === 'org_admin' && !requester.isPlatformAdmin) {
    return { ok: false, code: 'forbidden' };
  }

  const email = data.email.trim().toLowerCase();

  const [existingAccount] = await db
    .select({ personId: accounts.personId })
    .from(accounts)
    .where(eq(accounts.email, email))
    .limit(1);
  if (existingAccount && unitIds.length > 0) {
    const found = await Promise.all(
      unitIds.map((unitId) =>
        findMembership(
          existingAccount.personId,
          scope.organizationId,
          scope.communityId,
          scope.unitId,
          data.role,
          unitId,
        ),
      ),
    );
    if (found.every(Boolean)) {
      return { ok: false, code: 'conflict' };
    }
  } else if (existingAccount) {
    const existingMembership = await findMembership(
      existingAccount.personId,
      scope.organizationId,
      scope.communityId,
      scope.unitId,
      data.role,
    );
    if (existingMembership) {
      return { ok: false, code: 'conflict' };
    }
  }

  const token = generateToken();
  const insertedInvitations = await db
    .transaction(async (tx) => {
      const inserted = await tx
        .insert(invitations)
        .values({
          tokenHash: hashToken(token),
          email,
          organizationId: scope.organizationId,
          communityId: scope.communityId,
          unitId: scope.unitId,
          locationUnitId: unitIds[0] ?? scope.locationUnitId,
          role: data.role,
          status: 'pending',
          expiresAt: expiryDate(data.expiresInDays),
          invitedByPersonId: requester.personId,
        })
        .returning();

      const invitationRow = inserted[0];
      if (!invitationRow) {
        throw new Error('Invitation insert returned no rows');
      }
      if (unitIds.length > 0) {
        await tx
          .insert(invitationUnits)
          .values(
            unitIds.map((locationUnitId) => ({ invitationId: invitationRow.id, locationUnitId })),
          )
          .onConflictDoNothing();
      }

      return inserted;
    })
    .catch((error: unknown) => {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === '23505'
      ) {
        return null;
      }
      throw error;
    });

  if (!insertedInvitations) {
    return { ok: false, code: 'conflict' };
  }
  const invitation = insertedInvitations[0];
  if (!invitation) {
    return { ok: false, code: 'invalid_payload' };
  }

  const acceptUrl = buildAcceptUrl(token);
  const emailSent = await deliverInvitationEmail({
    invitationId: invitation.id,
    to: email,
    acceptUrl,
    role: data.role,
    expiresAt: invitation.expiresAt,
    communityName: await communityNameFor(scope.communityId),
  });

  return { ok: true, data: { invitation, acceptUrl, emailSent } };
}

type InvitationWithUnits = typeof invitations.$inferSelect & {
  units: { id: string; code: string; path: string }[];
};

export async function listInvitations(
  requester: InvitationRequester,
  filters: { status?: string; communityId?: string },
): Promise<InvitationWithUnits[]> {
  const conditions = [];
  if (!requester.isPlatformAdmin) {
    conditions.push(eq(invitations.organizationId, requester.orgId));
  }
  if (requester.role === 'community_admin' && requester.communityId) {
    conditions.push(eq(invitations.communityId, requester.communityId));
  } else if (filters.communityId) {
    conditions.push(eq(invitations.communityId, filters.communityId));
  }
  if (filters.status) {
    conditions.push(eq(invitations.status, filters.status as 'pending'));
  }

  const rows = await db
    .select()
    .from(invitations)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(invitations.createdAt))
    .limit(100);

  if (rows.length === 0) return [];

  const unitRows = await db
    .select({
      invitationId: invitationUnits.invitationId,
      id: locationUnits.id,
      code: locationUnits.code,
      name: locationUnits.name,
    })
    .from(invitationUnits)
    .innerJoin(locationUnits, eq(invitationUnits.locationUnitId, locationUnits.id))
    .where(
      inArray(
        invitationUnits.invitationId,
        rows.map((row) => row.id),
      ),
    );

  const pathCache = new Map<string, string>();
  const unitsByInvitation = new Map<string, { id: string; code: string; path: string }[]>();

  for (const unit of unitRows) {
    let path = pathCache.get(unit.id);
    if (path === undefined) {
      path = (await buildLocationPath(unit.id)) ?? unit.code ?? unit.name;
      pathCache.set(unit.id, path);
    }
    const list = unitsByInvitation.get(unit.invitationId) ?? [];
    list.push({ id: unit.id, code: unit.code ?? unit.name, path });
    unitsByInvitation.set(unit.invitationId, list);
  }

  return rows.map((row) => ({ ...row, units: unitsByInvitation.get(row.id) ?? [] }));
}

export async function revokeInvitation(
  id: string,
  requester: InvitationRequester,
): Promise<InvitationResult<typeof invitations.$inferSelect>> {
  const [invitation] = await db.select().from(invitations).where(eq(invitations.id, id)).limit(1);
  if (!invitation) return { ok: false, code: 'not_found' };
  if (!canManage(invitation, requester)) return { ok: false, code: 'forbidden' };

  const [updated] = await db
    .update(invitations)
    .set({ status: 'revoked', updatedAt: new Date() })
    .where(eq(invitations.id, id))
    .returning();

  return { ok: true, data: updated };
}

export async function resendInvitation(
  id: string,
  requester: InvitationRequester,
): Promise<InvitationResult<InvitationDelivery>> {
  const [invitation] = await db.select().from(invitations).where(eq(invitations.id, id)).limit(1);
  if (!invitation) return { ok: false, code: 'not_found' };
  if (!canManage(invitation, requester)) return { ok: false, code: 'forbidden' };
  if (invitation.status !== 'pending') return { ok: false, code: 'gone' };

  const token = generateToken();
  const [updated] = await db
    .update(invitations)
    .set({
      tokenHash: hashToken(token),
      expiresAt: expiryDate(),
      updatedAt: new Date(),
    })
    .where(eq(invitations.id, id))
    .returning();

  const acceptUrl = buildAcceptUrl(token);
  const emailSent = await deliverInvitationEmail({
    invitationId: updated.id,
    to: updated.email,
    acceptUrl,
    role: updated.role,
    expiresAt: updated.expiresAt,
    communityName: await communityNameFor(updated.communityId),
  });

  return { ok: true, data: { invitation: updated, acceptUrl, emailSent } };
}

async function buildLocationPath(locationUnitId: string): Promise<string | null> {
  const parts: string[] = [];
  let currentId: string | null = locationUnitId;
  for (let depth = 0; depth < 10 && currentId; depth += 1) {
    const [node] = await db
      .select({ name: locationUnits.name, parentId: locationUnits.parentId })
      .from(locationUnits)
      .where(eq(locationUnits.id, currentId))
      .limit(1);
    if (!node) break;
    parts.unshift(node.name);
    currentId = node.parentId;
  }
  return parts.length ? parts.join(' / ') : null;
}

type InvitationPreviewWithPath = PublicInvitationPreview & {
  locationPath: string | null;
  units: { id: string; code: string; path: string }[];
};

export async function previewInvitation(
  token: string,
): Promise<InvitationResult<InvitationPreviewWithPath>> {
  const [row] = await db
    .select({
      invitation: invitations,
      communityName: communities.name,
      unitCode: units.code,
      locationUnitCode: locationUnits.code,
    })
    .from(invitations)
    .leftJoin(communities, eq(invitations.communityId, communities.id))
    .leftJoin(units, eq(invitations.unitId, units.id))
    .leftJoin(locationUnits, eq(invitations.locationUnitId, locationUnits.id))
    .where(eq(invitations.tokenHash, hashToken(token)))
    .limit(1);

  if (!row) return { ok: false, code: 'not_found' };
  if (row.invitation.status !== 'pending') return { ok: false, code: 'gone' };
  if (row.invitation.expiresAt.getTime() < Date.now()) {
    return { ok: false, code: 'gone' };
  }

  const locationPath = row.invitation.locationUnitId
    ? await buildLocationPath(row.invitation.locationUnitId)
    : null;

  const unitRows = await db
    .select({ id: locationUnits.id, code: locationUnits.code, name: locationUnits.name })
    .from(invitationUnits)
    .innerJoin(locationUnits, eq(invitationUnits.locationUnitId, locationUnits.id))
    .where(eq(invitationUnits.invitationId, row.invitation.id));

  const unitList = await Promise.all(
    unitRows.map(async (unit) => ({
      id: unit.id,
      code: unit.code ?? unit.name,
      path: (await buildLocationPath(unit.id)) ?? unit.code ?? unit.name,
    })),
  );

  return {
    ok: true,
    data: {
      communityName: row.communityName ?? 'Comunidad',
      unitCode: row.locationUnitCode ?? row.unitCode ?? null,
      locationPath,
      units: unitList,
      role: row.invitation.role,
      maskedEmail: maskEmail(row.invitation.email),
      expiresAt: row.invitation.expiresAt,
    },
  };
}

const RESIDENT_RELATIONSHIP_BY_ROLE: Partial<Record<string, 'owner' | 'tenant' | 'resident'>> = {
  owner: 'owner',
  tenant: 'tenant',
  resident: 'resident',
};

async function invitationUnitIds(invitation: {
  id: string;
  locationUnitId: string | null;
}): Promise<string[]> {
  const rows = await db
    .select({ locationUnitId: invitationUnits.locationUnitId })
    .from(invitationUnits)
    .where(eq(invitationUnits.invitationId, invitation.id));
  if (rows.length > 0) {
    return rows.map((row) => row.locationUnitId);
  }
  return invitation.locationUnitId ? [invitation.locationUnitId] : [];
}

function todayDate(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

export interface BulkInvitationRowInput {
  unit: string;
  email: string;
  name?: string;
}

export type BulkInvitationRowStatus = 'valid' | 'created' | 'skipped' | 'failed';

export interface BulkInvitationRowResult {
  index: number;
  unit: string;
  email: string;
  name?: string;
  status: BulkInvitationRowStatus;
  reason?: string;
  unitId?: string;
  unitPath?: string;
}

export interface BulkInvitationSummary {
  total: number;
  valid: number;
  created: number;
  skipped: number;
  failed: number;
}

export interface BulkInvitationPreview {
  rows: BulkInvitationRowResult[];
  summary: BulkInvitationSummary;
}

async function communityUnitIndex(communityId: string) {
  const rows = await db
    .select({
      id: locationUnits.id,
      parentId: locationUnits.parentId,
      name: locationUnits.name,
      code: locationUnits.code,
    })
    .from(locationUnits)
    .where(and(eq(locationUnits.communityId, communityId), eq(locationUnits.status, 'active')));

  const byId = new Map(rows.map((row) => [row.id, row]));
  const parentIds = new Set(
    rows.map((row) => row.parentId).filter((value): value is string => Boolean(value)),
  );
  const pathCache = new Map<string, string>();

  function pathOf(id: string): string {
    const cached = pathCache.get(id);
    if (cached) return cached;

    const parts: string[] = [];
    const visited = new Set<string>();
    let current = byId.get(id);

    while (current && !visited.has(current.id)) {
      visited.add(current.id);
      parts.unshift(current.code?.trim() || current.name);
      current = current.parentId ? byId.get(current.parentId) : undefined;
    }

    const path = parts.join(' > ');
    pathCache.set(id, path);
    return path;
  }

  const byCode = new Map<string, typeof rows>();
  const byPath = new Map<string, typeof rows>();

  for (const row of rows) {
    if (row.code) {
      const key = row.code.trim().toLowerCase();
      byCode.set(key, [...(byCode.get(key) ?? []), row]);
    }
    const pathKey = pathOf(row.id).toLowerCase();
    byPath.set(pathKey, [...(byPath.get(pathKey) ?? []), row]);
  }

  return { byCode, byPath, parentIds, pathOf };
}

type UnitResolution =
  | { ok: true; unitId: string; unitPath: string }
  | { ok: false; reason: string };

function resolveBulkUnit(
  index: Awaited<ReturnType<typeof communityUnitIndex>>,
  rawUnit: string,
): UnitResolution {
  const value = rawUnit.trim().replace(/\s+/g, ' ');
  if (!value) return { ok: false, reason: 'unit_required' };

  const key = value.toLowerCase();
  const byCode = index.byCode.get(key) ?? [];
  const candidates = byCode.length > 0 ? byCode : (index.byPath.get(key) ?? []);

  if (candidates.length === 0) return { ok: false, reason: 'unit_not_found' };

  const leaves = candidates.filter((unit) => !index.parentIds.has(unit.id));
  if (leaves.length === 0) return { ok: false, reason: 'unit_not_leaf' };
  if (leaves.length > 1) return { ok: false, reason: 'unit_ambiguous' };

  const leaf = leaves[0]!;
  return { ok: true, unitId: leaf.id, unitPath: index.pathOf(leaf.id) };
}

async function resolveBulkCommunity(
  communityId: string,
  requester: InvitationRequester,
): Promise<InvitationResult<string>> {
  if (!requester.isPlatformAdmin && requester.role !== 'org_admin') {
    if (requester.communityId !== communityId) return { ok: false, code: 'forbidden' };
  }

  const [community] = await db
    .select({ organizationId: communities.organizationId })
    .from(communities)
    .where(eq(communities.id, communityId))
    .limit(1);

  if (!community) return { ok: false, code: 'not_found' };

  if (!requester.isPlatformAdmin && community.organizationId !== requester.orgId) {
    return { ok: false, code: 'forbidden' };
  }

  return { ok: true, data: community.organizationId };
}

function summarizeBulk(rows: BulkInvitationRowResult[]): BulkInvitationSummary {
  return rows.reduce<BulkInvitationSummary>(
    (summary, row) => {
      summary.total += 1;
      if (row.status === 'valid') summary.valid += 1;
      if (row.status === 'created') summary.created += 1;
      if (row.status === 'skipped') summary.skipped += 1;
      if (row.status === 'failed') summary.failed += 1;
      return summary;
    },
    { total: 0, valid: 0, created: 0, skipped: 0, failed: 0 },
  );
}

export async function previewBulkInvitations(
  input: { communityId: string; rows: BulkInvitationRowInput[] },
  requester: InvitationRequester,
): Promise<InvitationResult<BulkInvitationPreview>> {
  const scope = await resolveBulkCommunity(input.communityId, requester);
  if (!scope.ok) return scope;

  const index = await communityUnitIndex(input.communityId);
  const seen = new Set<string>();

  const rows = input.rows.map<BulkInvitationRowResult>((row, position) => {
    const base = {
      index: position,
      unit: row.unit,
      email: row.email.trim().toLowerCase(),
      name: row.name?.trim() || undefined,
    };

    const resolution = resolveBulkUnit(index, row.unit);
    if (!resolution.ok) {
      return { ...base, status: 'failed', reason: resolution.reason };
    }

    const duplicateKey = `${resolution.unitId}|${base.email}`;
    if (seen.has(duplicateKey)) {
      return {
        ...base,
        status: 'failed',
        reason: 'duplicate_row',
        unitId: resolution.unitId,
        unitPath: resolution.unitPath,
      };
    }
    seen.add(duplicateKey);

    return {
      ...base,
      status: 'valid',
      unitId: resolution.unitId,
      unitPath: resolution.unitPath,
    };
  });

  return { ok: true, data: { rows, summary: summarizeBulk(rows) } };
}

export async function createBulkInvitations(
  input: { communityId: string; rows: BulkInvitationRowInput[] },
  requester: InvitationRequester,
): Promise<InvitationResult<BulkInvitationPreview>> {
  const preview = await previewBulkInvitations(input, requester);
  if (!preview.ok) return preview;

  const rows: BulkInvitationRowResult[] = [];

  for (const row of preview.data.rows) {
    if (row.status !== 'valid' || !row.unitId) {
      rows.push(row);
      continue;
    }

    const created = await createInvitation(
      {
        email: row.email,
        role: 'resident',
        communityId: input.communityId,
        locationUnitIds: [row.unitId],
      },
      requester,
    );

    if (created.ok) {
      rows.push({ ...row, status: 'created' });
      continue;
    }

    if (created.code === 'conflict' || created.code === 'already_member') {
      rows.push({ ...row, status: 'skipped', reason: 'already_member' });
      continue;
    }

    rows.push({ ...row, status: 'failed', reason: created.code });
  }

  return { ok: true, data: { rows, summary: summarizeBulk(rows) } };
}

export async function acceptInvitation(
  token: string,
  body: { name?: string; password?: string; phone?: string; documentNumber?: string },
  authenticatedAccountId?: string,
): Promise<InvitationResult<authService.AuthResult>> {
  const [invitation] = await db
    .select()
    .from(invitations)
    .where(eq(invitations.tokenHash, hashToken(token)))
    .limit(1);

  if (!invitation) return { ok: false, code: 'not_found' };
  if (invitation.status !== 'pending') return { ok: false, code: 'gone' };
  if (invitation.expiresAt.getTime() < Date.now()) {
    await db
      .update(invitations)
      .set({ status: 'expired', updatedAt: new Date() })
      .where(eq(invitations.id, invitation.id));
    return { ok: false, code: 'gone' };
  }

  const email = invitation.email;
  const [existingAccount] = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(eq(accounts.email, email))
    .limit(1);

  if (existingAccount) {
    if (!authenticatedAccountId) return { ok: false, code: 'login_required' };
    if (existingAccount.id !== authenticatedAccountId) {
      return { ok: false, code: 'email_mismatch' };
    }

    const personId = await authService.personIdForEmail(email);
    if (!personId) return { ok: false, code: 'not_found' };

    const unitIds = await invitationUnitIds(invitation);
    let createdCount = 0;

    for (const unitId of unitIds.length > 0 ? unitIds : [null]) {
      const inserted = await db
        .insert(memberships)
        .values({
          personId,
          organizationId: invitation.organizationId,
          communityId: invitation.communityId,
          unitId: invitation.unitId,
          locationUnitId: unitId,
          role: invitation.role,
          status: 'active',
        })
        .onConflictDoNothing()
        .returning({ id: memberships.id });
      if (inserted.length > 0) createdCount += 1;

      const relationship = RESIDENT_RELATIONSHIP_BY_ROLE[invitation.role];
      if (unitId && relationship) {
        await db
          .insert(locationResidents)
          .values({
            locationUnitId: unitId,
            personId,
            relationship,
            validFrom: todayDate(),
            status: 'active',
          })
          .onConflictDoNothing();
      }
    }

    if (createdCount === 0) return { ok: false, code: 'already_member' };

    const membership = await findMembership(
      personId,
      invitation.organizationId,
      invitation.communityId,
      invitation.unitId,
      invitation.role,
      unitIds[0] ?? null,
    );
    if (!membership) return { ok: false, code: 'conflict' };

    await db.transaction(async (tx) => {
      if (invitation.role === 'org_admin') {
        await tx
          .update(memberships)
          .set({ status: 'inactive', updatedAt: new Date() })
          .where(otherOrgAdminsCondition(invitation.organizationId, membership.id));
      }

      await tx
        .update(invitations)
        .set({ status: 'accepted', acceptedAt: new Date(), updatedAt: new Date() })
        .where(eq(invitations.id, invitation.id));
    });

    const tokens = await authService.switchContext(existingAccount.id, membership.id);
    if (!tokens) return { ok: false, code: 'conflict' };
    return { ok: true, data: tokens };
  }

  if (!body.name || !body.password || body.password.length < 8) {
    return { ok: false, code: 'invalid_payload' };
  }

  const passwordHash = await hashPassword(body.password);

  try {
    const tokens = await db.transaction(async (tx) => {
      const [firstName, ...lastNameParts] = body.name!.trim().split(/\s+/);
      const [person] = await tx
        .insert(people)
        .values({
          firstName: firstName || email,
          lastName: lastNameParts.join(' '),
          contactEmail: email,
          phone: body.phone?.trim() || null,
          documentNumber: body.documentNumber?.trim() || null,
          status: 'active',
        })
        .returning();

      const [account] = await tx
        .insert(accounts)
        .values({
          personId: person.id,
          email,
          passwordHash,
          active: true,
          activatedAt: new Date(),
          isPlatformAdmin: false,
        })
        .returning({ id: accounts.id });

      const unitIds = await invitationUnitIds(invitation);
      let primaryMembership: typeof memberships.$inferSelect | null = null;

      for (const unitId of unitIds.length > 0 ? unitIds : [null]) {
        const [created] = await tx
          .insert(memberships)
          .values({
            personId: person.id,
            organizationId: invitation.organizationId,
            communityId: invitation.communityId,
            unitId: invitation.unitId,
            locationUnitId: unitId,
            role: invitation.role,
            status: 'active',
          })
          .onConflictDoNothing()
          .returning();

        if (created && unitId === (unitIds[0] ?? null)) {
          primaryMembership = created;
        }

        const relationship = RESIDENT_RELATIONSHIP_BY_ROLE[invitation.role];
        if (unitId && relationship) {
          await tx
            .insert(locationResidents)
            .values({
              locationUnitId: unitId,
              personId: person.id,
              relationship,
              validFrom: todayDate(),
              status: 'active',
            })
            .onConflictDoNothing();
        }
      }

      if (!primaryMembership) {
        throw new Error('Membership insert returned no rows');
      }
      const membership = primaryMembership;

      await tx
        .update(invitations)
        .set({ status: 'accepted', acceptedAt: new Date(), updatedAt: new Date() })
        .where(eq(invitations.id, invitation.id));

      if (invitation.role === 'org_admin') {
        await tx
          .update(memberships)
          .set({ status: 'inactive', updatedAt: new Date() })
          .where(otherOrgAdminsCondition(invitation.organizationId, membership.id));
      }

      return { accountId: account.id, membershipId: membership.id };
    });

    const auth = await authService.switchContext(tokens.accountId, tokens.membershipId);
    if (!auth) return { ok: false, code: 'conflict' };
    return { ok: true, data: auth };
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === '23505') return { ok: false, code: 'conflict' };
    throw err;
  }
}
