import type { BitacoraListResponse } from '@porteria/shared';

type RequestFn = <T>(
  path: string,
  options?: { method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'; body?: unknown },
) => Promise<T>;

export function listBitacora(
  request: RequestFn,
  params: { shiftId: string; page?: number; pageSize?: number },
) {
  const search = new URLSearchParams();
  search.set('shiftId', params.shiftId);
  search.set('page', String(params.page ?? 1));
  search.set('pageSize', String(params.pageSize ?? 50));
  return request<BitacoraListResponse>(`/api/bitacora?${search.toString()}`);
}
