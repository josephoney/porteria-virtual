import { eq } from 'drizzle-orm';

import { createDb } from '@porteria/database';
import { accounts, memberships, people } from '@porteria/database/schema';

const db = createDb();

/** Roles que un administrador de comunidad puede resetear dentro de su comunidad. */
const COMMUNITY_MANAGED_ROLES = new Set(['operator', 'guard', 'resident']);

export type ManageResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: 'not_found' | 'forbidden' | 'weak_password' | 'invalid_target' };

export interface PasswordActor {
  accountId: string | null;
  personId: string | null;
  orgId: string;
  communityId: string | null;
  role: string;
  isPlatformAdmin: boolean;
}

export interface ResetPasswordInput {
  mode: 'direct' | 'link';
  password?: string;
  mustChange: boolean;
}

export interface TargetAccount {
  accountId: string;
  email: string;
  firstName: string;
  isPlatformAdmin: boolean;
  active: boolean;
  mustChangePassword: boolean;
  memberships: { role: string; communityId: string | null; organizationId: string | null }[];
}

/** Cuenta objetivo con sus membresías, para decidir el alcance. */
export async function loadTarget(accountId: string): Promise<TargetAccount | null> {
  const [account] = await db
    .select({
      accountId: accounts.id,
      email: accounts.email,
      firstName: people.firstName,
      isPlatformAdmin: accounts.isPlatformAdmin,
      active: accounts.active,
      mustChangePassword: accounts.mustChangePassword,
      personId: accounts.personId,
    })
    .from(accounts)
    .innerJoin(people, eq(people.id, accounts.personId))
    .where(eq(accounts.id, accountId))
    .limit(1);

  if (!account) return null;

  const rows = await db
    .select({
      role: memberships.role,
      communityId: memberships.communityId,
      organizationId: memberships.organizationId,
    })
    .from(memberships)
    .where(eq(memberships.personId, account.personId));

  return {
    accountId: account.accountId,
    email: account.email,
    firstName: account.firstName,
    isPlatformAdmin: account.isPlatformAdmin,
    active: account.active,
    mustChangePassword: account.mustChangePassword,
    memberships: rows.map((row) => ({
      role: row.role,
      communityId: row.communityId ?? null,
      organizationId: row.organizationId ?? null,
    })),
  };
}

/**
 * Quién puede resetear la contraseña de quién.
 *
 * La regla vive en el servidor y no en la interfaz: esconder un botón no impide
 * llamar la API. Nadie toca a un administrador de plataforma ni a un par, y
 * todos quedan dentro de su organización.
 */
export function canManagePassword(actor: PasswordActor, target: TargetAccount): boolean {
  if (target.isPlatformAdmin) return false;
  if (target.accountId === actor.accountId) return false;
  if (target.memberships.length === 0) return false;

  const inOrganization = target.memberships.some(
    (membership) => membership.organizationId === actor.orgId,
  );
  if (!inOrganization) return false;

  if (actor.isPlatformAdmin) return true;

  if (actor.role === 'org_admin') {
    // Un par no se resetea: la organización no tiene un administrador de
    // administradores, y dos org_admin podrían bloquearse entre sí.
    return target.memberships.every(
      (membership) => membership.organizationId === actor.orgId && membership.role !== 'org_admin',
    );
  }

  if (actor.role === 'community_admin') {
    return target.memberships.every(
      (membership) =>
        membership.communityId === actor.communityId &&
        COMMUNITY_MANAGED_ROLES.has(membership.role),
    );
  }

  return false;
}
