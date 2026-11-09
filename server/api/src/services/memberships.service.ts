import { and, eq } from 'drizzle-orm';
import { createDb } from '@porteria/database';
import { memberships, users } from '@porteria/database/schema';
import { createEventEnvelope, type MembershipRole } from '@porteria/shared';
import { enqueueEvent } from './outbox.service.js';
import { canAssignRole } from './role-policy.service.js';
import { validateLocationUnit } from './location-unit.service.js';

const db = createDb();

export interface Requester {
  sub: string;
  role: string;
  orgId: string;
  communityId: string | null;
  isPlatformAdmin: boolean;
}

export interface MembershipResult {
  id: string;
  userId: string;
  organizationId: string;
  communityId: string | null;
  unitId: string | null;
  locationUnitId: string | null;
  role: string;
  status: string;
}

export function validateMembershipScope(
  role: string,
  communityId?: string | null,
  unitId?: string | null,
): string | null {
  const operational = ['community_admin', 'operator', 'guard'];
  const occupants = ['owner', 'tenant', 'resident'];

  if (operational.includes(role) && !communityId) {
    return `Role ${role} requires communityId`;
  }
  if (occupants.includes(role) && (!communityId || !unitId)) {
    return `Role ${role} requires communityId and unitId`;
  }
  return null;
}

function toMembershipResult(row: typeof memberships.$inferSelect): MembershipResult {
  return {
    id: row.id,
    userId: row.userId,
    organizationId: row.organizationId,
    communityId: row.communityId,
    unitId: row.unitId,
    locationUnitId: row.locationUnitId,
    role: row.role,
    status: row.status,
  };
}

function canManage(requester: Requester): boolean {
  return (
    requester.isPlatformAdmin ||
    requester.role === 'org_admin' ||
    requester.role === 'community_admin'
  );
}

export async function createMembership(
  data: {
    userId: string;
    role: string;
    communityId?: string | null;
    unitId?: string | null;
    locationUnitId?: string | null;
  },
  requester: Requester,
): Promise<{ membership?: MembershipResult; error?: string }> {
  if (!canManage(requester)) return { error: 'Insufficient permissions' };
  if (!canAssignRole(requester, data.role as MembershipRole)) {
    return { error: 'Role out of scope' };
  }

  const [user] = await db.select().from(users).where(eq(users.id, data.userId)).limit(1);
  if (!user) return { error: 'User not found' };

  const communityId =
    requester.role === 'community_admin' ? requester.communityId : (data.communityId ?? null);

  if (requester.role === 'community_admin' && data.communityId && data.communityId !== requester.communityId) {
    return { error: 'Community out of scope' };
  }

  const scopeError = validateMembershipScope(
    data.role,
    communityId,
    data.locationUnitId ?? data.unitId,
  );
  if (scopeError) return { error: scopeError };

  if (data.locationUnitId && communityId) {
    const location = await validateLocationUnit(data.locationUnitId, communityId);
    if (!location.ok) {
      return {
        error:
          location.code === 'not_found'
            ? 'Location unit not found in this community'
            : 'Location unit must be a leaf',
      };
    }
  }

  const created = await db.transaction(async (tx) => {
    const [membership] = await tx
      .insert(memberships)
      .values({
        userId: data.userId,
        organizationId: requester.orgId,
        communityId,
        unitId: data.unitId ?? null,
        locationUnitId: data.locationUnitId ?? null,
        role: data.role as MembershipRole,
        status: 'active',
      })
      .returning();

    await enqueueEvent(
      tx,
      createEventEnvelope({
        eventType: 'membership.created',
        organizationId: requester.orgId,
        communityId,
        actorId: requester.sub,
        actorRole: requester.role,
        payload: {
          membershipId: membership.id,
          userId: data.userId,
          role: data.role,
        },
      }),
    );

    return membership;
  });

  return { membership: toMembershipResult(created) };
}

export async function updateMembership(
  id: string,
  data: {
    role?: string;
    status?: 'active' | 'inactive';
    communityId?: string | null;
    unitId?: string | null;
    locationUnitId?: string | null;
  },
  requester: Requester,
): Promise<{ membership?: MembershipResult; error?: string; notFound?: boolean }> {
  if (!canManage(requester)) return { error: 'Insufficient permissions' };
  if (data.role && !canAssignRole(requester, data.role as MembershipRole)) {
    return { error: 'Role out of scope' };
  }

  const conditions = [eq(memberships.id, id)];
  if (!requester.isPlatformAdmin) {
    conditions.push(eq(memberships.organizationId, requester.orgId));
  }
  const [existing] = await db
    .select()
    .from(memberships)
    .where(and(...conditions))
    .limit(1);

  if (!existing) return { notFound: true };

  if (
    requester.role === 'community_admin' &&
    existing.communityId !== requester.communityId
  ) {
    return { error: 'Community out of scope' };
  }

  const nextCommunityId =
    data.communityId !== undefined ? data.communityId : existing.communityId;
  const nextUnitId = data.unitId !== undefined ? data.unitId : existing.unitId;
  const nextLocationUnitId =
    data.locationUnitId !== undefined ? data.locationUnitId : existing.locationUnitId;
  const nextRole = data.role ?? existing.role;

  const scopeError = validateMembershipScope(
    nextRole,
    nextCommunityId,
    nextLocationUnitId ?? nextUnitId,
  );
  if (scopeError) return { error: scopeError };

  if (nextLocationUnitId && nextCommunityId) {
    const location = await validateLocationUnit(nextLocationUnitId, nextCommunityId);
    if (!location.ok) {
      return {
        error:
          location.code === 'not_found'
            ? 'Location unit not found in this community'
            : 'Location unit must be a leaf',
      };
    }
  }

  const updated = await db.transaction(async (tx) => {
    const [membership] = await tx
      .update(memberships)
      .set({
        role: nextRole as MembershipRole,
        status: data.status ?? existing.status,
        communityId: nextCommunityId,
        unitId: nextUnitId,
        locationUnitId: nextLocationUnitId,
        updatedAt: new Date(),
      })
      .where(eq(memberships.id, id))
      .returning();

    await enqueueEvent(
      tx,
      createEventEnvelope({
        eventType: 'membership.updated',
        organizationId: existing.organizationId,
        communityId: nextCommunityId,
        actorId: requester.sub,
        actorRole: requester.role,
        payload: { membershipId: id, changedFields: Object.keys(data) },
      }),
    );

    return membership;
  });

  return { membership: toMembershipResult(updated) };
}
