import { createContext, useState, useCallback, useEffect, useRef, useContext, type ReactNode } from 'react';
import { CONFIG } from '../config';
import { configureApiClient } from '../lib/apiClient';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  organizationId: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const STORAGE_KEYS = {
  ACCESS_TOKEN: 'auth_access_token',
  REFRESH_TOKEN: 'auth_refresh_token',
  USER: 'auth_user',
} as const;

const AuthContext = createContext<AuthState>({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,
  login: async () => {},
  logout: () => {},
});

function persistAuth(accessToken: string, refreshToken: string, userData: User) {
  localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, accessToken);
  localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
  localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(userData));
}

function clearPersistedAuth() {
  localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
  localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
  localStorage.removeItem(STORAGE_KEYS.USER);
}

function getStoredRefreshToken(): string | null {
  return localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
}

function getStoredUser(): User | null {
  const raw = localStorage.getItem(STORAGE_KEYS.USER);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const initRan = useRef(false);

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
      .then((data: { accessToken: string; refreshToken: string }) => {
        const storedUser = getStoredUser();
        if (storedUser) {
          persistAuth(data.accessToken, data.refreshToken, storedUser);
          setToken(data.accessToken);
          setUser(storedUser);
        }
      })
      .catch(() => {
        clearPersistedAuth();
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

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
          const data: { accessToken: string; refreshToken: string } = await res.json();
          const storedUser = getStoredUser();
          if (storedUser) {
            persistAuth(data.accessToken, data.refreshToken, storedUser);
            setUser(storedUser);
          }
          setToken(data.accessToken);
          return data.accessToken;
        } catch {
          return null;
        }
      },
      onLogout: () => {
        clearPersistedAuth();
        setToken(null);
        setUser(null);
      },
    });
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch(`${CONFIG.API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Invalid credentials');
    }
    const data = await res.json();
    persistAuth(data.accessToken, data.refreshToken, data.user);
    setToken(data.accessToken);
    setUser(data.user);
  }, []);

  const logout = useCallback(() => {
    const rt = getStoredRefreshToken();
    clearPersistedAuth();
    setToken(null);
    setUser(null);
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
      value={{ user, token, isAuthenticated: !!token, isLoading, login, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
