import { type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return null;

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  return <>{children}</>;
}

export function RequirePlatformAdmin({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (!user.isPlatformAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export function RequireRole({ role, children }: { role: string | string[]; children: ReactNode }) {
  const { user, activeMembership } = useAuth();
  const roles = Array.isArray(role) ? role : [role];
  if (!user) return <Navigate to="/" replace />;
  if (user.isPlatformAdmin && activeMembership?.id === 'platform') {
    return <Navigate to="/platform" replace />;
  }
  if (user.isPlatformAdmin) return <>{children}</>;
  if (!activeMembership || !roles.includes(activeMembership.role)) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}
