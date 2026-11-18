import type {
  PassCompanion,
  PassRuleSummary,
  ScanDecisionResponse,
  ScanPassResponse,
} from '@porteria/shared';

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

export function confirmScan(request: RequestFn, scanId: string, note?: string) {
  const observation = note?.trim();
  return request<ScanDecisionResponse>(`/api/access/scans/${scanId}/confirm`, {
    method: 'POST',
    body: observation ? { note: observation } : {},
  });
}

export function rejectScan(request: RequestFn, scanId: string, note?: string) {
  const observation = note?.trim();
  return request<ScanDecisionResponse>(`/api/access/scans/${scanId}/reject`, {
    method: 'POST',
    // Without an observation the machine code keeps the existing wording in the
    // activity list; a note doubles as the reason and is also stored separately.
    body: observation ? { reason: observation, note: observation } : { reason: 'denied_by_guard' },
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
  maxUses: number;
  exitCount: number;
  validFrom: string;
  validUntil: string;
  destinationName: string;
  destinationPath: string;
  /** Readable rule built by the API: days, window and uses left today. */
  rule: PassRuleSummary;
  /** People arriving with the primary visitor, with their documents. */
  companions: PassCompanion[];
}

/** Authorizations registered for a document, for the guard to confirm by hand. */
export function searchAuthorizations(request: RequestFn, document: string) {
  return request<IdentityCandidate[]>(
    `/api/access/authorizations?document=${encodeURIComponent(document)}`,
  );
}

export function confirmIdentityEntry(request: RequestFn, passId: string, action: 'entry' | 'exit') {
  return request<{ passId: string; status: string; bitacoraEntryId: string | null }>(
    `/api/access/authorizations/${passId}/confirm`,
    { method: 'POST', body: { action } },
  );
}

/** Records a refused entry so the attempt stays audited and the app can reset. */
export function denyIdentityEntry(
  request: RequestFn,
  passId: string,
  reason: 'expired' | 'used' | 'denied',
) {
  return request<{ bitacoraEntryId: string | null }>(`/api/access/authorizations/${passId}/deny`, {
    method: 'POST',
    body: { reason },
  });
}
