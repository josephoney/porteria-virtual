import type {
  AccessPass,
  CreatePassDto,
  PassLinkResponse,
  PassQrResponse,
  PassStatus,
} from '@porteria/shared';

import { apiFetch } from './client';

export interface PassWithPath extends AccessPass {
  locationPath: string;
}

export function listPasses(token: string, status?: PassStatus) {
  const query = status ? `?status=${encodeURIComponent(status)}` : '';
  return apiFetch<PassWithPath[]>(`/api/passes${query}`, { token });
}

export function getPass(token: string, passId: string) {
  return apiFetch<PassWithPath>(`/api/passes/${passId}`, { token });
}

export function createPass(token: string, input: CreatePassDto) {
  return apiFetch<PassLinkResponse>('/api/passes', {
    method: 'POST',
    token,
    body: input,
  });
}

export function getPassQr(token: string, passId: string) {
  return apiFetch<PassQrResponse>(`/api/passes/${passId}/qr`, { token });
}

export function revokePass(token: string, passId: string) {
  return apiFetch<{ id: string; status: PassStatus }>(`/api/passes/${passId}/revoke`, {
    method: 'POST',
    token,
  });
}

export function regenerateLink(token: string, passId: string) {
  return apiFetch<{ shareUrl: string; linkExpiresAt: string }>(
    `/api/passes/${passId}/regenerate-link`,
    { method: 'POST', token },
  );
}
