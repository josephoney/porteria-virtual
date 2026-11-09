export type AdminAction =
  | 'organization.read'
  | 'organization.update'
  | 'community.read'
  | 'community.create'
  | 'community.update'
  | 'location.read'
  | 'location.write'
  | 'people.read'
  | 'people.write'
  | 'staff.read'
  | 'staff.write'
  | 'reports.read';

export interface AdminRequester {
  role: string;
  orgId: string;
  communityId: string | null;
  isPlatformAdmin: boolean;
}

export interface AdminScope {
  organizationId: string;
  communityId?: string | null;
}

const ORG_ACTIONS: AdminAction[] = [
  'organization.read',
  'organization.update',
  'community.read',
  'community.create',
  'community.update',
  'location.read',
  'location.write',
  'people.read',
  'people.write',
  'staff.read',
  'staff.write',
  'reports.read',
];

const COMMUNITY_ACTIONS: AdminAction[] = [
  'community.read',
  'community.update',
  'location.read',
  'location.write',
  'people.read',
  'people.write',
  'reports.read',
];

const READ_ONLY_ACTIONS: AdminAction[] = [
  'community.read',
  'location.read',
  'reports.read',
];

export function can(
  requester: AdminRequester,
  action: AdminAction,
  scope: AdminScope,
): boolean {
  if (requester.isPlatformAdmin) {
    return (
      action === 'organization.read' ||
      action === 'community.read' ||
      action === 'location.read' ||
      action === 'people.read' ||
      action === 'staff.read' ||
      action === 'reports.read'
    );
  }

  if (requester.orgId !== scope.organizationId) return false;

  if (requester.role === 'org_admin') {
    return ORG_ACTIONS.includes(action);
  }

  if (requester.communityId !== scope.communityId) return false;

  if (requester.role === 'community_admin') {
    return COMMUNITY_ACTIONS.includes(action);
  }

  if (requester.role === 'operator' || requester.role === 'guard') {
    return READ_ONLY_ACTIONS.includes(action);
  }

  return false;
}
