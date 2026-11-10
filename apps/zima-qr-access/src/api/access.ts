import type { ScanDecisionResponse, ScanPassResponse } from '@porteria/shared';

type RequestFn = <T>(
  path: string,
  options?: { method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'; body?: unknown },
) => Promise<T>;

export function scanPass(request: RequestFn, qrToken: string) {
  return request<ScanPassResponse>('/api/access/scan', {
    method: 'POST',
    body: { token: qrToken },
  });
}

export function confirmScan(request: RequestFn, scanId: string) {
  return request<ScanDecisionResponse>(`/api/access/scans/${scanId}/confirm`, {
    method: 'POST',
  });
}

export function rejectScan(request: RequestFn, scanId: string, reason?: string) {
  return request<ScanDecisionResponse>(`/api/access/scans/${scanId}/reject`, {
    method: 'POST',
    body: reason ? { reason } : {},
  });
}
