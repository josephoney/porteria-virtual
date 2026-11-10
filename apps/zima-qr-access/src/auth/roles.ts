const RESIDENT_ROLES = new Set(['owner', 'tenant', 'resident']);
const GUARD_ROLES = new Set(['guard']);

export type AppMode = 'resident' | 'guard' | 'none';

export function modeForRole(role: string): AppMode {
  if (RESIDENT_ROLES.has(role)) return 'resident';
  if (GUARD_ROLES.has(role)) return 'guard';
  return 'none';
}

export function homeForRole(role: string): '/home' | '/scan' | '/no-mode' {
  switch (modeForRole(role)) {
    case 'resident':
      return '/home';
    case 'guard':
      return '/scan';
    default:
      return '/no-mode';
  }
}
