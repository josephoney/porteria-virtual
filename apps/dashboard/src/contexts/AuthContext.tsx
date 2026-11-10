import {
  createContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  useContext,
  type ReactNode,
} from 'react';
import { CONFIG } from '../config';
import { configureApiClient } from '../lib/apiClient';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  isPlatformAdmin: boolean;
  accountId?: string;
  personId?: string;
}

export interface ActiveMembership {
  id: string;
  role: string;
  organizationId: string;
  communityId: string | null;
  unitId: string | null;
  locationUnitId?: string | null;
  defaultAccessPointId?: string | null;
}

interface LoginResult {
  requiresContextSelection: boolean;
  memberships?: ActiveMembership[];
  selectionToken?: string;
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  activeMembership: ActiveMembership | null;
  memberships: ActiveMembership[];
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string, communitySlug?: string) => Promise<LoginResult>;
  selectContext: (membershipId: string, selectionToken: string) => Promise<void>;
  acceptInvitation: (token: string, name?: string, password?: string) => Promise<void>;
  switchContext: (membershipId: string) => Promise<void>;
  logout: () => void;
}

const STORAGE_KEYS = {
  ACCESS_TOKEN: 'auth_access_token',
  REFRESH_TOKEN: 'auth_refresh_token',
  USER: 'auth_user',
  ACTIVE_MEMBERSHIP: 'auth_active_membership',
  MEMBERSHIPS: 'auth_memberships',
} as const;

const AuthContext = createContext<AuthState>({
  user: null,
  token: null,
  activeMembership: null,
  memberships: [],
  isAuthenticated: false,
  isLoading: true,
  login: async () => ({ requiresContextSelection: false }),
  acceptInvitation: async () => {},
  selectContext: async () => {},
  switchContext: async () => {},
  logout: () => {},
});

function persistAuth(
  accessToken: string,
  refreshToken: string,
  userData: AuthUser,
  activeMembership: ActiveMembership,
  memberships?: ActiveMembership[],
) {
  localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, accessToken);
  localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
  localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(userData));
  localStorage.setItem(STORAGE_KEYS.ACTIVE_MEMBERSHIP, JSON.stringify(activeMembership));
  if (memberships) {
    localStorage.setItem(STORAGE_KEYS.MEMBERSHIPS, JSON.stringify(memberships));
  }
}

function clearPersistedAuth() {
  localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
  localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
  localStorage.removeItem(STORAGE_KEYS.USER);
  localStorage.removeItem(STORAGE_KEYS.ACTIVE_MEMBERSHIP);
  localStorage.removeItem(STORAGE_KEYS.MEMBERSHIPS);
}

function getStoredRefreshToken(): string | null {
  return localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
}

function getStoredJson<T>(key: string): T | null {
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [activeMembership, setActiveMembership] = useState<ActiveMembership | null>(null);
  const [memberships, setMemberships] = useState<ActiveMembership[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const initRan = useRef(false);

  const applyAuth = useCallback(
    (data: {
      accessToken: string;
      refreshToken: string;
      user: AuthUser;
      activeMembership: ActiveMembership;
    }) => {
      const storedMemberships = getStoredJson<ActiveMembership[]>(STORAGE_KEYS.MEMBERSHIPS) ?? [
        data.activeMembership,
      ];
      persistAuth(
        data.accessToken,
        data.refreshToken,
        data.user,
        data.activeMembership,
        storedMemberships,
      );
      setToken(data.accessToken);
      setUser(data.user);
      setActiveMembership(data.activeMembership);
      setMemberships(storedMemberships);
    },
    [],
  );

  useEffect(() => {
    if (initRan.current) return;
    initRan.current = true;

    const refreshToken = getStoredRefreshToken();
    if (!refreshToken) {
      setIsLoading(false);
      return;
    }

    fetch(`${CONFIG.API_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    })
      .then((res) => {
        if (!res.ok) throw new Error('Refresh failed');
        return res.json();
      })
      .then((data) => applyAuth(data))
      .catch(() => {
        clearPersistedAuth();
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [applyAuth]);

  useEffect(() => {
    configureApiClient({
      getToken: () => localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN),
      onRefresh: async () => {
        const rt = getStoredRefreshToken();
        if (!rt) return null;
        try {
          const res = await fetch(`${CONFIG.API_URL}/api/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken: rt }),
          });
          if (!res.ok) return null;
          const data = await res.json();
          applyAuth(data);
          return data.accessToken as string;
        } catch {
          return null;
        }
      },
      onLogout: () => {
        clearPersistedAuth();
        setToken(null);
        setUser(null);
        setActiveMembership(null);
        setMemberships([]);
      },
    });
  }, [applyAuth]);

  const login = useCallback(
    async (email: string, password: string, communitySlug?: string): Promise<LoginResult> => {
      const res = await fetch(`${CONFIG.API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, ...(communitySlug ? { communitySlug } : {}) }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Invalid credentials');
      }

      const data = await res.json();
      if (data.requiresContextSelection) {
        setMemberships(data.memberships ?? []);
        localStorage.setItem(STORAGE_KEYS.MEMBERSHIPS, JSON.stringify(data.memberships ?? []));
        return {
          requiresContextSelection: true,
          memberships: data.memberships,
          selectionToken: data.selectionToken,
        };
      }

      setMemberships([data.activeMembership]);
      localStorage.setItem(STORAGE_KEYS.MEMBERSHIPS, JSON.stringify([data.activeMembership]));
      applyAuth(data);
      return { requiresContextSelection: false };
    },
    [applyAuth],
  );

  const acceptInvitation = useCallback(
    async (token: string, name?: string, password?: string) => {
      const accessToken = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

      const res = await fetch(`${CONFIG.API_URL}/api/public/invitations/${token}/accept`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ name, password }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'No se pudo aceptar la invitación');
      }
      const data = await res.json();
      applyAuth(data);
    },
    [applyAuth],
  );

  const selectContext = useCallback(
    async (membershipId: string, selectionToken: string) => {
      const res = await fetch(`${CONFIG.API_URL}/api/auth/context`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${selectionToken}`,
        },
        body: JSON.stringify({ membershipId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'No se pudo seleccionar el contexto');
      }
      const data = await res.json();
      applyAuth(data);
    },
    [applyAuth],
  );

  const switchContext = useCallback(
    async (membershipId: string) => {
      const accessToken = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
      const refreshToken = getStoredRefreshToken();
      if (!accessToken) throw new Error('Not authenticated');

      const res = await fetch(`${CONFIG.API_URL}/api/auth/context`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ membershipId, refreshToken }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'No se pudo cambiar de contexto');
      }
      const data = await res.json();
      applyAuth(data);
    },
    [applyAuth],
  );

  const logout = useCallback(() => {
    const rt = getStoredRefreshToken();
    clearPersistedAuth();
    setToken(null);
    setUser(null);
    setActiveMembership(null);
    setMemberships([]);
    if (rt) {
      fetch(`${CONFIG.API_URL}/api/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: rt }),
      }).catch(() => {});
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        activeMembership,
        memberships,
        isAuthenticated: !!token,
        isLoading,
        login,
        selectContext,
        acceptInvitation,
        switchContext,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
