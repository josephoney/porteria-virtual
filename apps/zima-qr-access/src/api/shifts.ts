import type {
  AccessPoint,
  ChangeAccessPointDto,
  EndShiftDto,
  GuardShiftCurrentResponse,
  GuardShiftListResponse,
  StartShiftDto,
} from '@porteria/shared';

type RequestFn = <T>(
  path: string,
  options?: { method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'; body?: unknown },
) => Promise<T>;

export interface AccessPointListResponse {
  items: AccessPoint[];
}

export function getCurrentShift(request: RequestFn) {
  return request<GuardShiftCurrentResponse>('/api/guard/shifts/current');
}

export function startShift(request: RequestFn, input: StartShiftDto = {}) {
  return request<GuardShiftCurrentResponse>('/api/guard/shifts/start', {
    method: 'POST',
    body: { source: 'app', ...input },
  });
}

export function changeAccessPoint(
  request: RequestFn,
  shiftId: string,
  input: ChangeAccessPointDto,
) {
  return request<GuardShiftCurrentResponse>(`/api/guard/shifts/${shiftId}/change-access-point`, {
    method: 'POST',
    body: { source: 'app', ...input },
  });
}

export function endShift(request: RequestFn, shiftId: string, input: EndShiftDto = {}) {
  return request<GuardShiftCurrentResponse>(`/api/guard/shifts/${shiftId}/end`, {
    method: 'POST',
    body: { source: 'app', ...input },
  });
}

export function listShifts(
  request: RequestFn,
  params: { page?: number; pageSize?: number; status?: 'open' | 'closed' } = {},
) {
  const search = new URLSearchParams();
  search.set('page', String(params.page ?? 1));
  search.set('pageSize', String(params.pageSize ?? 10));
  if (params.status) search.set('status', params.status);
  return request<GuardShiftListResponse>(`/api/guard/shifts?${search.toString()}`);
}

export function listAccessPoints(request: RequestFn, communityId: string, includeInactive = false) {
  const search = includeInactive ? '?includeInactive=true' : '';
  return request<AccessPointListResponse>(`/api/communities/${communityId}/access-points${search}`);
}
