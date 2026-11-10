import type { AuthUserSummary, MembershipSummary } from '@porteria/shared';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const KEY = 'zima.session';

export interface StoredSession {
  accessToken: string;
  refreshToken: string;
  user: AuthUserSummary;
  activeMembership: MembershipSummary;
}

const isWeb = Platform.OS === 'web';

interface WebStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function webStorage(): WebStorage | undefined {
  return (globalThis as { localStorage?: WebStorage }).localStorage;
}

export async function loadSession(): Promise<StoredSession | null> {
  try {
    const raw = isWeb ? webStorage()?.getItem(KEY) : await SecureStore.getItemAsync(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredSession;
  } catch {
    return null;
  }
}

export async function saveSession(session: StoredSession): Promise<void> {
  const raw = JSON.stringify(session);
  if (isWeb) {
    webStorage()?.setItem(KEY, raw);
    return;
  }
  await SecureStore.setItemAsync(KEY, raw);
}

export async function clearSession(): Promise<void> {
  try {
    if (isWeb) {
      webStorage()?.removeItem(KEY);
      return;
    }
    await SecureStore.deleteItemAsync(KEY);
  } catch {
    // Storage cleanup is best-effort.
  }
}
