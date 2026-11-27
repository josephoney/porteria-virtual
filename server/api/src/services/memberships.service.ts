import { and, eq, ne } from 'drizzle-orm';
import { createDb } from '@porteria/database';
import { memberships, accounts, guardShifts } from '@porteria/database/schema';
import { createEventEnvelope, type MembershipRole } from '@porteria/shared';
import { enqueueEvent } from './outbox.service.js';
import { canAssignRole, canDeleteRole } from './role-policy.service.js';
import { validateLocationUnit } from './location-unit.service.js';
import { assignWorkstation, checkWorkstationTarget } from './workstation.service.js';
import { insertEvent } from './events.service.js';

const db = createDb();

export interface Requester {
  sub: string;
  /** Contexto activo del actor: sirve para impedir que se borre a sí mismo. */
  membershipId?: string | null;
  role: string;
  orgId: string;
  communityId: string | null;
  isPlatformAdmin: boolean;
}

export interface MembershipResult {
  id: string;
  personId: string;
  organizationId: string;
  communityId: string | null;
  unitId: string | null;
  locationUnitId: string | null;
  defaultAccessPointId: string | null;
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
    personId: row.personId,
    organizationId: row.organizationId,
    communityId: row.communityId,
    unitId: row.unitId,
    locationUnitId: row.locationUnitId,
    defaultAccessPointId: row.defaultAccessPointId,
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
    defaultAccessPointId?: string | null;
  },
  requester: Requester,
): Promise<{ membership?: MembershipResult; error?: string }> {
  if (!canManage(requester)) return { error: 'Insufficient permissions' };
  if (!canAssignRole(requester, data.role as MembershipRole)) {
    return { error: 'Role out of scope' };
  }

  // El id recibido es el de la cuenta (lo que expone el recurso de usuarios).
  // La membresía cuelga de la persona; `memberships.user_id` ya no se escribe.
  const [account] = await db
    .select({ id: accounts.id, personId: accounts.personId })
    .from(accounts)
    .where(eq(accounts.id, data.userId))
    .limit(1);

  if (!account) return { error: 'User not found' };
  const personId = account.personId;

  const communityId =
    requester.role === 'community_admin' ? requester.communityId : (data.communityId ?? null);

  if (
    requester.role === 'community_admin' &&
    data.communityId &&
    data.communityId !== requester.communityId
  ) {
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

  if (data.defaultAccessPointId) {
    const target = await checkWorkstationTarget({
      requester,
      role: data.role,
      communityId,
      accessPointId: data.defaultAccessPointId,
    });
    if (!target.ok) return { error: target.code };
  }

  const created = await db.transaction(async (tx) => {
    const [membership] = await tx
      .insert(memberships)
      .values({
        personId,
        organizationId: requester.orgId,
        communityId,
        unitId: data.unitId ?? null,
        locationUnitId: data.locationUnitId ?? null,
        defaultAccessPointId: data.defaultAccessPointId ?? null,
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
    defaultAccessPointId?: string | null;
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

  if (requester.role === 'community_admin' && existing.communityId !== requester.communityId) {
    return { error: 'Community out of scope' };
  }

  const nextCommunityId = data.communityId !== undefined ? data.communityId : existing.communityId;
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

  // El puesto de trabajo tiene reglas propias y un solo dueño. El PATCH delega
  // para no duplicar validaciones ni auditoría.
  if (data.defaultAccessPointId !== undefined) {
    const assignment = await assignWorkstation({
      requester,
      membershipId: id,
      accessPointId: data.defaultAccessPointId,
    });
    if (!assignment.ok) return { error: assignment.code };
  } else if (existing.defaultAccessPointId && nextRole !== 'guard') {
    // Un rol que no hace turnos no puede conservar un puesto asignado.
    const cleared = await assignWorkstation({
      requester,
      membershipId: id,
      accessPointId: null,
    });
    if (!cleared.ok) return { error: cleared.code };
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

export type DeleteMembershipResult =
  | { deleted: true }
  | { error: string }
  | { notFound: true };

/**
 * Borra una membresía de forma definitiva.
 *
 * La baja lógica sigue existiendo (`PATCH status`); esto es la salida para limpiar
 * asignaciones que ya no deben seguir apareciendo. El historial no se pierde porque la
 * bitácora y los pases cuelgan de la persona, no de la membresía.
 */
export async function deleteMembership(
  id: string,
  requester: Requester,
): Promise<DeleteMembershipResult> {
  if (requester.isPlatformAdmin) return { error: 'tenant_read_only' };
  if (!canManage(requester)) return { error: 'Insufficient permissions' };

  const [existing] = await db
    .select()
    .from(memberships)
    .where(and(eq(memberships.id, id), eq(memberships.organizationId, requester.orgId)))
    .limit(1);

  if (!existing) return { notFound: true };

  if (requester.role === 'community_admin' && existing.communityId !== requester.communityId) {
    return { notFound: true };
  }

  if (requester.membershipId && existing.id === requester.membershipId) {
    return { error: 'own_active_membership' };
  }

  if (existing.role === 'org_admin' && existing.status === 'active') {
    const [other] = await db
      .select({ id: memberships.id })
      .from(memberships)
      .where(
        and(
          eq(memberships.organizationId, existing.organizationId),
          eq(memberships.role, 'org_admin'),
          eq(memberships.status, 'active'),
          ne(memberships.id, existing.id),
        ),
      )
      .limit(1);
    if (!other) return { error: 'last_org_admin' };
  }

  if (!canDeleteRole(requester, existing.role as MembershipRole)) {
    return { error: 'Role out of scope' };
  }

  if (existing.communityId) {
    // Un turno abierto quedaría sin membresía que lo respalde: se fuerza el cierre
    // primero, que ya existe en la bitácora.
    const [shift] = await db
      .select({ id: guardShifts.id })
      .from(guardShifts)
      .where(
        and(
          eq(guardShifts.guardPersonId, existing.personId),
          eq(guardShifts.communityId, existing.communityId),
          eq(guardShifts.status, 'open'),
        ),
      )
      .limit(1);
    if (shift) return { error: 'open_shift' };
  }

  await db.transaction(async (tx) => {
    await tx.delete(memberships).where(eq(memberships.id, id));
    await insertEvent(
      {
        eventType: 'membership.deleted',
        actorId: requester.sub,
        actorRole: requester.role,
        organizationId: existing.organizationId,
        communityId: existing.communityId,
        metadata: {
          membershipId: id,
          personId: existing.personId,
          role: existing.role,
          previousStatus: existing.status,
        },
      },
      tx,
    );
  });

  return { deleted: true };
}
