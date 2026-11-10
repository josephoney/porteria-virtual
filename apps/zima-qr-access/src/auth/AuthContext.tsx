import type { MembershipSummary } from '@porteria/shared';
import type { ReactNode } from 'react';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { ApiError, apiFetch, type RequestOptions } from '@/api/client';
import {
  login as loginRequest,
  logout as logoutRequest,
  refreshSession as refreshSessionRequest,
  selectContext as selectContextRequest,
} from '@/api/auth';
import { clearSession, loadSession, saveSession, type StoredSession } from './storage';

export interface PendingSelection {
  selectionToken: string;
  memberships: MembershipSummary[];
}

export type SignInResult = { kind: 'session'; session: StoredSession } | { kind: 'selection' };

type RequestFn = <T>(path: string, options?: Omit<RequestOptions, 'token'>) => Promise<T>;

interface AuthContextValue {
  session: StoredSession | null;
  pendingSelection: PendingSelection | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<SignInResult>;
  selectMembership: (membershipId: string) => Promise<StoredSession>;
  signOut: () => Promise<void>;
  request: RequestFn;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<StoredSession | null>(null);
  const [pendingSelection, setPendingSelection] = useState<PendingSelection | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const stored = await loadSession();
      if (cancelled) return;

      if (!stored) {
        setLoading(false);
        return;
      }

      setSession(stored);
      setLoading(false);

      try {
        const refreshed = await refreshSessionRequest(stored.refreshToken);
        const next: StoredSession = {
          ...stored,
          accessToken: refreshed.accessToken,
          refreshToken: refreshed.refreshToken,
          user: refreshed.user,
          activeMembership: refreshed.activeMembership,
        };
        await saveSession(next);
        if (!cancelled) setSession(next);
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          await clearSession();
          if (!cancelled) setSession(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const refresh = useCallback(async (): Promise<StoredSession | null> => {
    if (!session) return null;

    try {
      const refreshed = await refreshSessionRequest(session.refreshToken);
      const next: StoredSession = {
        ...session,
        accessToken: refreshed.accessToken,
        refreshToken: refreshed.refreshToken,
        user: refreshed.user,
        activeMembership: refreshed.activeMembership,
      };
      await saveSession(next);
      setSession(next);
      return next;
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        await clearSession();
        setSession(null);
      }
      return null;
    }
  }, [session]);

  const request = useCallback(
    async <T,>(path: string, options: Omit<RequestOptions, 'token'> = {}): Promise<T> => {
      if (!session) {
        throw new ApiError(401, 'not_authenticated');
      }

      try {
        return await apiFetch<T>(path, { ...options, token: session.accessToken });
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          const next = await refresh();
          if (next) {
            return apiFetch<T>(path, { ...options, token: next.accessToken });
          }
        }
        throw error;
      }
    },
    [session, refresh],
  ) as RequestFn;

  const signIn = useCallback(async (email: string, password: string): Promise<SignInResult> => {
    const result = await loginRequest(email, password);

    if ('requiresContextSelection' in result) {
      setPendingSelection({
        selectionToken: result.selectionToken,
        memberships: result.memberships,
      });
      return { kind: 'selection' };
    }

    const next: StoredSession = {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      user: result.user,
      activeMembership: result.activeMembership,
    };
    await saveSession(next);
    setSession(next);
    return { kind: 'session', session: next };
  }, []);

  const selectMembership = useCallback(
    async (membershipId: string): Promise<StoredSession> => {
      if (!pendingSelection) {
        throw new ApiError(400, 'no_pending_selection');
      }

      const result = await selectContextRequest(pendingSelection.selectionToken, membershipId);
      const next: StoredSession = {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        user: result.user,
        activeMembership: result.activeMembership,
      };
      await saveSession(next);
      setSession(next);
      setPendingSelection(null);
      return next;
    },
    [pendingSelection],
  );

  const signOut = useCallback(async () => {
    if (session) {
      await logoutRequest(session.refreshToken).catch(() => undefined);
    }
    await clearSession();
    setSession(null);
    setPendingSelection(null);
  }, [session]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      pendingSelection,
      loading,
      signIn,
      selectMembership,
      signOut,
      request,
    }),
    [session, pendingSelection, loading, signIn, selectMembership, signOut, request],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return context;
}
