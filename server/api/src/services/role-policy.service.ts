import type { MembershipRole } from '@porteria/shared';

export interface RoleRequester {
  role: string;
  isPlatformAdmin: boolean;
}

const COMMUNITY_ROLES: MembershipRole[] = [
  'operator',
  'guard',
  'owner',
  'tenant',
  'resident',
  'staff',
];

const ORG_ROLES: MembershipRole[] = ['community_admin', ...COMMUNITY_ROLES];

const ALL_ROLES: MembershipRole[] = ['org_admin', ...ORG_ROLES];

export function canAssignRole(
  requester: RoleRequester,
  role: MembershipRole,
): boolean {
  if (requester.isPlatformAdmin) return true;
  if (requester.role === 'org_admin') return ORG_ROLES.includes(role);
  if (requester.role === 'community_admin') return COMMUNITY_ROLES.includes(role);
  return false;
}

export function assignableRoles(requester: RoleRequester): MembershipRole[] {
  if (requester.isPlatformAdmin) return ALL_ROLES;
  if (requester.role === 'org_admin') return ORG_ROLES;
  if (requester.role === 'community_admin') return COMMUNITY_ROLES;
  return [];
}

/**
 * Quién puede eliminar una membresía.
 *
 * No es lo mismo que asignar: un `org_admin` puede limpiar una membresía de
 * `org_admin` vieja (por ejemplo, un administrador que ya no trabaja), algo que
 * nunca podría crear. Las guardas de "último administrador" y "contexto propio"
 * viven en el servicio, porque dependen del estado de la organización.
 */
export function canDeleteRole(requester: RoleRequester, role: MembershipRole): boolean {
  if (requester.isPlatformAdmin) return false;
  if (requester.role === 'org_admin') return true;
  return canAssignRole(requester, role);
}
