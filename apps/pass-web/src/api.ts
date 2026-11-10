import type { PassQrResponse, PassStatusResponse, PublicPassPreview } from '@porteria/shared';

const BASE = '/api/public/passes';

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, status: number) {
    super(code);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body) headers.set('Content-Type', 'application/json');

  const response = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    ...init,
    headers,
  });

  const data = (await response.json().catch(() => null)) as { message?: string } | null;
  if (!response.ok) {
    throw new ApiError(data?.message ?? 'request_failed', response.status);
  }

  return data as T;
}

export function getPreview(token: string): Promise<PublicPassPreview> {
  return request<PublicPassPreview>(`/${encodeURIComponent(token)}`);
}

export function bindPass(
  token: string,
  pin?: string,
): Promise<{ passId: string; linkExpiresAt: string }> {
  return request(`/${encodeURIComponent(token)}/bind`, {
    method: 'POST',
    body: JSON.stringify(pin ? { pin } : {}),
  });
}

export function getQr(token: string): Promise<PassQrResponse> {
  return request<PassQrResponse>(`/${encodeURIComponent(token)}/qr`);
}

export function getStatus(token: string): Promise<PassStatusResponse> {
  return request<PassStatusResponse>(`/${encodeURIComponent(token)}/status`);
}
