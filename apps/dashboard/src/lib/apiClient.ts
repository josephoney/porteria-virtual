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
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = `${CONFIG.API_URL}${path}`;
  const res = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
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
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const url = `${CONFIG.API_URL}${path}`;
  const res = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
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
