import { and, asc, desc, eq, isNull } from 'drizzle-orm';
import { createDb } from '@porteria/database';
import {
  accessPoints,
  accounts,
  communities,
  guardShiftSegments,
  guardShifts,
  memberships,
  people,
} from '@porteria/database/schema';
import type {
  AccessPointGuard,
  WorkstationAssignment,
  WorkstationAssignmentResult,
} from '@porteria/shared';
import { insertEvent } from './events.service.js';
import { evaluateWorkstationTarget, type WorkstationErrorCode } from '../lib/workstation-rules.js';

const db = createDb();

export interface WorkstationRequester {
  sub: string;
  personId?: string | null;
  role: string;
  orgId: string;
  communityId: string | null;
  isPlatformAdmin: boolean;
}

export type { WorkstationErrorCode } from '../lib/workstation-rules.js';

export type WorkstationResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: WorkstationErrorCode };

interface MembershipContext {
  id: string;
  personId: string;
  organizationId: string;
  communityId: string | null;
  role: string;
  defaultAccessPointId: string | null;
}

interface AccessPointView {
  id: string;
  name: string;
  type: 'door' | 'gate' | 'turnstile';
  direction: 'entry' | 'exit' | 'both';
  active: boolean;
}

async function loadMembershipContext(membershipId: string): Promise<MembershipContext | null> {
  const [row] = await db
    .select({
      id: memberships.id,
      personId: memberships.personId,
      organizationId: memberships.organizationId,
      communityId: memberships.communityId,
      role: memberships.role,
      defaultAccessPointId: memberships.defaultAccessPointId,
    })
    .from(memberships)
    .where(eq(memberships.id, membershipId))
    .limit(1);
  return row ?? null;
}

/**
 * Alcance del actor sobre la membresía.
 *
 * El platform admin queda afuera a propósito: los guardarraíles de tenant
 * read-only le impiden escribir datos de tenant.
 */
function scopeError(
  requester: WorkstationRequester,
  membership: MembershipContext,
): WorkstationErrorCode | null {
  if (requester.isPlatformAdmin) return 'tenant_read_only';
  if (requester.role !== 'org_admin' && requester.role !== 'community_admin') return 'forbidden';
  if (requester.role === 'org_admin') {
    return membership.organizationId === requester.orgId ? null : 'not_found';
  }
  if (!requester.communityId || membership.communityId !== requester.communityId) {
    return 'not_found';
  }
  return null;
}

async function loadAccessPoint(
  accessPointId: string,
  communityId: string,
): Promise<AccessPointView | null> {
  const [row] = await db
    .select({
      id: accessPoints.id,
      name: accessPoints.name,
      type: accessPoints.type,
      direction: accessPoints.direction,
      active: accessPoints.active,
    })
    .from(accessPoints)
    .where(and(eq(accessPoints.id, accessPointId), eq(accessPoints.communityId, communityId)))
    .limit(1);
  return row ?? null;
}

async function buildAssignment(input: {
  membershipId: string;
  communityId: string | null;
  accessPointId: string | null;
  communityAccessPoint?: AccessPointView | null;
}): Promise<WorkstationAssignment> {
  const base = {
    membershipId: input.membershipId,
    communityId: input.communityId,
    accessPointId: input.accessPointId,
  };

  if (!input.accessPointId) {
    return { ...base, name: null, type: null, direction: null, active: null };
  }

  const accessPoint =
    input.communityAccessPoint ??
    (input.communityId ? await loadAccessPoint(input.accessPointId, input.communityId) : null);

  if (!accessPoint) {
    // La FK `on delete set null` debería evitarlo, pero nunca exponemos un id
    // sin datos: si el acceso ya no existe, la vista queda vacía.
    return { ...base, name: null, type: null, direction: null, active: null };
  }

  return {
    ...base,
    name: accessPoint.name,
    type: accessPoint.type,
    direction: accessPoint.direction,
    active: accessPoint.active,
  };
}

async function openShiftForPerson(
  personId: string,
): Promise<{ shiftId: string; accessPointId: string | null } | null> {
  const [shift] = await db
    .select({ id: guardShifts.id })
    .from(guardShifts)
    .where(and(eq(guardShifts.guardPersonId, personId), eq(guardShifts.status, 'open')))
    .limit(1);

  if (!shift) return null;

  const [segment] = await db
    .select({ accessPointId: guardShiftSegments.accessPointId })
    .from(guardShiftSegments)
    .where(and(eq(guardShiftSegments.shiftId, shift.id), isNull(guardShiftSegments.endedAt)))
    .orderBy(desc(guardShiftSegments.startedAt))
    .limit(1);

  return { shiftId: shift.id, accessPointId: segment?.accessPointId ?? null };
}

/**
 * Valida que un puesto pueda asignarse a una membresía con este rol y alcance.
 *
 * Se comparte con el alta de membresía, que necesita validar antes de insertar,
 * y con la asignación, que ya tiene la membresía en la mano.
 */
export async function checkWorkstationTarget(input: {
  requester: WorkstationRequester;
  role: string;
  communityId: string | null;
  accessPointId: string | null;
}): Promise<
  { ok: true; accessPoint: AccessPointView | null } | { ok: false; code: WorkstationErrorCode }
> {
  const preflight = evaluateWorkstationTarget({
    isPlatformAdmin: input.requester.isPlatformAdmin,
    actorRole: input.requester.role,
    membershipRole: input.role,
    membershipCommunityId: input.communityId,
    accessPointId: null,
    accessPoint: null,
  });
  if (preflight) return { ok: false, code: preflight };

  // Guarda de tipos: el preflight ya rechazó la membresía sin comunidad.
  const communityId = input.communityId;
  if (!communityId) return { ok: false, code: 'membership_requires_community' };
  if (!input.accessPointId) return { ok: true, accessPoint: null };

  const accessPoint = await loadAccessPoint(input.accessPointId, communityId);
  const code = evaluateWorkstationTarget({
    isPlatformAdmin: input.requester.isPlatformAdmin,
    actorRole: input.requester.role,
    membershipRole: input.role,
    membershipCommunityId: communityId,
    accessPointId: input.accessPointId,
    accessPoint,
  });
  if (code) return { ok: false, code };

  return { ok: true, accessPoint };
}

/**
 * Asigna, reemplaza o desasigna el puesto de trabajo de una membresía de guardia.
 *
 * Es la única puerta de escritura: `memberships.service.updateMembership` delega
 * acá cuando llega `defaultAccessPointId`.
 */
export async function assignWorkstation(input: {
  requester: WorkstationRequester;
  membershipId: string;
  accessPointId: string | null;
}): Promise<WorkstationResult<WorkstationAssignmentResult>> {
  const { requester, membershipId, accessPointId } = input;

  const membership = await loadMembershipContext(membershipId);
  if (!membership) return { ok: false, code: 'not_found' };

  const scope = scopeError(requester, membership);
  if (scope) return { ok: false, code: scope };

  const target = await checkWorkstationTarget({
    requester,
    role: membership.role,
    communityId: membership.communityId,
    accessPointId,
  });
  if (!target.ok) return { ok: false, code: target.code };
  const resolvedAccessPoint = target.accessPoint;

  const previousAccessPointId = membership.defaultAccessPointId;
  const changed = previousAccessPointId !== accessPointId;

  if (changed) {
    await db.transaction(async (tx) => {
      await tx
        .update(memberships)
        .set({ defaultAccessPointId: accessPointId, updatedAt: new Date() })
        .where(eq(memberships.id, membershipId));

      await insertEvent(
        {
          eventType: accessPointId
            ? 'admin.workstation.assigned'
            : 'admin.workstation.unassigned',
          actorId: requester.sub,
          actorPersonId: requester.personId ?? null,
          actorRole: requester.role,
          organizationId: membership.organizationId,
          communityId: membership.communityId,
          metadata: {
            membershipId,
            personId: membership.personId,
            previousAccessPointId,
            accessPointId,
          },
        },
        tx,
      );
    });
  }

  const assignment = await buildAssignment({
    membershipId,
    communityId: membership.communityId,
    accessPointId,
    communityAccessPoint: resolvedAccessPoint,
  });
  const shift = await openShiftForPerson(membership.personId);

  return {
    ok: true,
    data: {
      ...assignment,
      appliesNextShift: Boolean(shift),
      activeShiftAccessPointId: shift?.accessPointId ?? null,
    },
  };
}

/**
 * Puesto de la sesión activa.
 *
 * Devuelve `null` cuando la cuenta no tiene una membresía de guardia activa; el
 * cliente lo trata como "sin puesto", no como error.
 */
export async function getWorkstationForAccount(
  accountId: string,
  membershipId?: string | null,
): Promise<WorkstationAssignment | null> {
  const [account] = await db
    .select({ personId: accounts.personId })
    .from(accounts)
    .where(eq(accounts.id, accountId))
    .limit(1);

  if (!account) return null;

  const conditions = [
    eq(memberships.personId, account.personId),
    eq(memberships.status, 'active'),
    eq(memberships.role, 'guard'),
  ];
  if (membershipId) conditions.push(eq(memberships.id, membershipId));

  const [membership] = await db
    .select({
      id: memberships.id,
      communityId: memberships.communityId,
      defaultAccessPointId: memberships.defaultAccessPointId,
    })
    .from(memberships)
    .where(and(...conditions))
    .orderBy(asc(memberships.createdAt))
    .limit(1);

  if (!membership) return null;

  return buildAssignment({
    membershipId: membership.id,
    communityId: membership.communityId,
    accessPointId: membership.defaultAccessPointId,
  });
}

async function canReadCommunity(
  requester: WorkstationRequester,
  communityId: string,
): Promise<WorkstationErrorCode | null> {
  const [community] = await db
    .select({ organizationId: communities.organizationId })
    .from(communities)
    .where(eq(communities.id, communityId))
    .limit(1);

  if (!community) return 'not_found';
  if (requester.isPlatformAdmin) return null;
  if (requester.role === 'org_admin') {
    return community.organizationId === requester.orgId ? null : 'forbidden';
  }
  if (requester.role === 'community_admin' && requester.communityId === communityId) {
    return null;
  }
  return 'forbidden';
}

/** Guardias asignados a un acceso, con su turno abierto si lo tienen. */
export async function listGuardsForAccessPoint(input: {
  requester: WorkstationRequester;
  communityId: string;
  accessPointId: string;
}): Promise<WorkstationResult<AccessPointGuard[]>> {
  const readable = await canReadCommunity(input.requester, input.communityId);
  if (readable) return { ok: false, code: readable };

  const accessPoint = await loadAccessPoint(input.accessPointId, input.communityId);
  if (!accessPoint) return { ok: false, code: 'not_found' };

  const rows = await db
    .select({
      membershipId: memberships.id,
      personId: memberships.personId,
      firstName: people.firstName,
      lastName: people.lastName,
      email: accounts.email,
      shiftId: guardShifts.id,
    })
    .from(memberships)
    .innerJoin(people, eq(people.id, memberships.personId))
    .leftJoin(accounts, eq(accounts.personId, memberships.personId))
    .leftJoin(
      guardShifts,
      and(eq(guardShifts.guardPersonId, memberships.personId), eq(guardShifts.status, 'open')),
    )
    .where(
      and(
        eq(memberships.defaultAccessPointId, input.accessPointId),
        eq(memberships.status, 'active'),
        eq(memberships.role, 'guard'),
      ),
    )
    .orderBy(asc(people.firstName), asc(people.lastName));

  return {
    ok: true,
    data: rows.map((row) => ({
      membershipId: row.membershipId,
      personId: row.personId,
      personName: [row.firstName, row.lastName].filter(Boolean).join(' ').trim(),
      email: row.email ?? null,
      onShift: Boolean(row.shiftId),
      shiftId: row.shiftId ?? null,
    })),
  };
}
