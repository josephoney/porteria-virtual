import { Redirect } from 'expo-router';
import type { ReactNode } from 'react';

import { LoadingView } from '@/components/ui';
import { useAuth } from './AuthContext';
import { homeForRole, modeForRole, type AppMode } from './roles';

export function RequireMode({ mode, children }: { mode: AppMode; children: ReactNode }) {
  const { session, loading } = useAuth();

  if (loading) {
    return <LoadingView message="Restaurando sesión…" />;
  }
  if (!session) {
    return <Redirect href="/" />;
  }
  if (modeForRole(session.activeMembership.role) !== mode) {
    return <Redirect href={homeForRole(session.activeMembership.role)} />;
  }
  return <>{children}</>;
}
