import type { LoginResponse, RefreshResponse } from '@porteria/shared';

import { apiFetch } from './client';

export function login(email: string, password: string) {
  return apiFetch<LoginResponse>('/api/auth/login', {
    method: 'POST',
    body: { email: email.trim().toLowerCase(), password },
  });
}

export function selectContext(selectionToken: string, membershipId: string) {
  return apiFetch<RefreshResponse>('/api/auth/context', {
    method: 'POST',
    token: selectionToken,
    body: { membershipId },
  });
}

export function refreshSession(refreshToken: string) {
  return apiFetch<RefreshResponse>('/api/auth/refresh', {
    method: 'POST',
    body: { refreshToken },
  });
}

export function logout(refreshToken: string) {
  return apiFetch<{ message: string }>('/api/auth/logout', {
    method: 'POST',
    body: { refreshToken },
  });
}
