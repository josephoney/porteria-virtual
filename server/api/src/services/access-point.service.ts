import { and, asc, eq } from 'drizzle-orm';
import { createDb } from '@porteria/database';
import { accessPoints, communities } from '@porteria/database/schema';
import type { AccessPoint, CreateAccessPointDto, UpdateAccessPointDto } from '@porteria/shared';

const db = createDb();

export interface AccessPointRequester {
  sub: string;
  role: string;
  orgId: string;
  communityId: string | null;
  isPlatformAdmin: boolean;
}

export type AccessPointResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: 'not_found' | 'forbidden' | 'conflict' | 'invalid' };

type AccessPointRow = typeof accessPoints.$inferSelect;

function toAccessPoint(row: AccessPointRow): AccessPoint {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    gpioPin: row.gpioPin,
    communityId: row.communityId,
    kioskId: null,
    failPolicy: row.failPolicy,
    direction: row.direction,
    active: row.active,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function loadCommunity(communityId: string) {
  const [community] = await db
    .select({ id: communities.id, organizationId: communities.organizationId })
    .from(communities)
    .where(eq(communities.id, communityId))
    .limit(1);
  return community ?? null;
}

async function canReadCommunity(
  requester: AccessPointRequester,
  communityId: string,
): Promise<boolean> {
  if (requester.isPlatformAdmin) return true;
  if (requester.role === 'org_admin') {
    const community = await loadCommunity(communityId);
    return Boolean(community && community.organizationId === requester.orgId);
  }
  return requester.communityId === communityId;
}

async function canManageCommunity(
  requester: AccessPointRequester,
  communityId: string,
): Promise<boolean> {
  if (requester.isPlatformAdmin) return false;
  if (requester.role === 'org_admin') {
    const community = await loadCommunity(communityId);
    return Boolean(community && community.organizationId === requester.orgId);
  }
  return requester.role === 'community_admin' && requester.communityId === communityId;
}

export async function listAccessPoints(
  requester: AccessPointRequester,
  communityId: string,
  includeInactive: boolean,
): Promise<AccessPointResult<AccessPoint[]>> {
  if (!(await canReadCommunity(requester, communityId))) {
    return { ok: false, code: 'forbidden' };
  }

  const community = await loadCommunity(communityId);
  if (!community) return { ok: false, code: 'not_found' };

  const activeOnly = requester.role === 'guard' || requester.isPlatformAdmin;
  const rows = await db
    .select()
    .from(accessPoints)
    .where(
      activeOnly || !includeInactive
        ? and(eq(accessPoints.communityId, communityId), eq(accessPoints.active, true))
        : eq(accessPoints.communityId, communityId),
    )
    .orderBy(asc(accessPoints.name));

  return { ok: true, data: rows.map(toAccessPoint) };
}

export async function createAccessPoint(
  requester: AccessPointRequester,
  communityId: string,
  input: CreateAccessPointDto,
): Promise<AccessPointResult<AccessPoint>> {
  if (!(await canManageCommunity(requester, communityId))) {
    return { ok: false, code: 'forbidden' };
  }

  try {
    const [row] = await db
      .insert(accessPoints)
      .values({
        communityId,
        name: input.name,
        type: input.type ?? 'gate',
        direction: input.direction ?? 'both',
        gpioPin: input.gpioPin ?? null,
        failPolicy: input.failPolicy ?? 'closed',
      })
      .returning();

    return { ok: true, data: toAccessPoint(row) };
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, code: 'conflict' };
    throw error;
  }
}

export async function updateAccessPoint(
  requester: AccessPointRequester,
  communityId: string,
  accessPointId: string,
  input: UpdateAccessPointDto,
): Promise<AccessPointResult<AccessPoint>> {
  if (!(await canManageCommunity(requester, communityId))) {
    return { ok: false, code: 'forbidden' };
  }

  const [existing] = await db
    .select()
    .from(accessPoints)
    .where(and(eq(accessPoints.id, accessPointId), eq(accessPoints.communityId, communityId)))
    .limit(1);

  if (!existing) return { ok: false, code: 'not_found' };

  try {
    const [row] = await db
      .update(accessPoints)
      .set({
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.type !== undefined ? { type: input.type } : {}),
        ...(input.direction !== undefined ? { direction: input.direction } : {}),
        ...(input.gpioPin !== undefined ? { gpioPin: input.gpioPin } : {}),
        ...(input.failPolicy !== undefined ? { failPolicy: input.failPolicy } : {}),
        ...(input.active !== undefined ? { active: input.active } : {}),
        updatedAt: new Date(),
      })
      .where(eq(accessPoints.id, accessPointId))
      .returning();

    return { ok: true, data: toAccessPoint(row) };
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, code: 'conflict' };
    throw error;
  }
}

export async function deactivateAccessPoint(
  requester: AccessPointRequester,
  communityId: string,
  accessPointId: string,
): Promise<AccessPointResult<AccessPoint>> {
  if (!(await canManageCommunity(requester, communityId))) {
    return { ok: false, code: 'forbidden' };
  }

  const [row] = await db
    .update(accessPoints)
    .set({ active: false, updatedAt: new Date() })
    .where(and(eq(accessPoints.id, accessPointId), eq(accessPoints.communityId, communityId)))
    .returning();

  if (!row) return { ok: false, code: 'not_found' };
  return { ok: true, data: toAccessPoint(row) };
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === '23505'
  );
}
