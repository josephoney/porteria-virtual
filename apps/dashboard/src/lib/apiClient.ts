import { CONFIG } from '../config';

export interface ApiResponse<T> {
  data: T;
  status: number;
}

export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

let getToken: () => string | null = () => null;
let onRefresh: () => Promise<string | null> = async () => null;
let onLogout: () => void = () => {};

let refreshPromise: Promise<string | null> | null = null;

export function configureApiClient(config: {
  getToken: () => string | null;
  onRefresh: () => Promise<string | null>;
  onLogout: () => void;
}) {
  getToken = config.getToken;
  onRefresh = config.onRefresh;
  onLogout = config.onLogout;
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  isRetry = false,
): Promise<ApiResponse<T>> {
  const token = getToken();
  const headers: Record<string, string> = {};
  let requestBody: string | undefined;
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    requestBody = JSON.stringify(body);
  } else if (method === 'POST' || method === 'PATCH') {
    headers['Content-Type'] = 'application/json';
    requestBody = '{}';
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = `${CONFIG.API_URL}${path}`;
  const res = await fetch(url, {
    method,
    headers,
    body: requestBody,
  });

  if (res.status === 401) {
    if (isRetry) {
      onLogout();
      throw new Error('Session expired');
    }

    if (refreshPromise) {
      const newToken = await refreshPromise;
      if (!newToken) {
        onLogout();
        throw new Error('Session expired');
      }
      return retryRequest<T>(method, path, body, newToken);
    }

    refreshPromise = onRefresh();
    try {
      const newToken = await refreshPromise;
      if (!newToken) {
        onLogout();
        throw new Error('Session expired');
      }
      return retryRequest<T>(method, path, body, newToken);
    } finally {
      refreshPromise = null;
    }
  }

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new ApiError(
      errorBody.message || `HTTP ${res.status}`,
      res.status,
      errorBody,
    );
  }

  if (res.status === 204) {
    return { data: undefined as T, status: res.status };
  }

  const data = await res.json();
  return { data, status: res.status };
}

async function retryRequest<T>(
  method: string,
  path: string,
  body: unknown | undefined,
  newToken: string,
): Promise<ApiResponse<T>> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${newToken}`,
  };
  let requestBody: string | undefined;
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    requestBody = JSON.stringify(body);
  } else if (method === 'POST' || method === 'PATCH') {
    headers['Content-Type'] = 'application/json';
    requestBody = '{}';
  }

  const url = `${CONFIG.API_URL}${path}`;
  const res = await fetch(url, {
    method,
    headers,
    body: requestBody,
  });

  if (res.status === 401) {
    onLogout();
    throw new Error('Session expired');
  }

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new ApiError(
      errorBody.message || `HTTP ${res.status}`,
      res.status,
      errorBody,
    );
  }

  if (res.status === 204) {
    return { data: undefined as T, status: res.status };
  }

  const data = await res.json();
  return { data, status: res.status };
}

export function get<T>(path: string): Promise<ApiResponse<T>> {
  return request<T>('GET', path);
}

export function post<T>(path: string, body?: unknown): Promise<ApiResponse<T>> {
  return request<T>('POST', path, body);
}

export function patch<T>(path: string, body?: unknown): Promise<ApiResponse<T>> {
  return request<T>('PATCH', path, body);
}

export function del<T>(path: string): Promise<ApiResponse<T>> {
  return request<T>('DELETE', path);
}

export async function assetObjectUrl(id: string): Promise<string | null> {
  const token = getToken();
  const response = await fetch(`${CONFIG.API_URL}/api/assets/${id}/content`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) return null;
  const blob = await response.blob();
  return URL.createObjectURL(blob);
}

export async function upload<T>(
  path: string,
  formData: FormData,
): Promise<ApiResponse<T>> {
  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${CONFIG.API_URL}${path}`, {
    method: 'POST',
    headers,
    body: formData,
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new ApiError(
      errorBody.message || `HTTP ${res.status}`,
      res.status,
      errorBody,
    );
  }

  const data = await res.json();
  return { data, status: res.status };
}
