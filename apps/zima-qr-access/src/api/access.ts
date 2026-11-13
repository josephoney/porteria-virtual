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

export interface IdentityCandidate {
  passId: string;
  visitorFirstName: string;
  visitorLastName: string;
  visitorDocument: string;
  type: string;
  status: string;
  presenceState: string;
  validFrom: string;
  validUntil: string;
  destinationName: string;
  destinationPath: string;
}

/** Authorizations registered for a document, for the guard to confirm by hand. */
export function searchAuthorizations(request: RequestFn, document: string) {
  return request<IdentityCandidate[]>(
    `/api/access/authorizations?document=${encodeURIComponent(document)}`,
  );
}

export function confirmIdentityEntry(request: RequestFn, passId: string) {
  return request<{ passId: string; status: string; bitacoraEntryId: string | null }>(
    `/api/access/authorizations/${passId}/confirm`,
    { method: 'POST' },
  );
}
