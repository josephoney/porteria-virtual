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
