import { CONFIG } from '../config';

export interface ApiResponse<T> {
  data: T;
  status: number;
  /** Total row count when the endpoint paginates through the `X-Total-Count` header. */
  total?: number;
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

export function apiBaseUrl(): string {
  return CONFIG.API_URL;
}

/**
 * The access token the client is using. Needed by the bitacora stream, which
 * cannot use `EventSource` because it does not accept an Authorization header.
 */
export function currentAccessToken(): string | null {
  return getToken();
}

/**
 * Refreshes the access token once, sharing the in-flight promise with regular
 * requests. The streams use `fetch` directly, so they need this to avoid
 * reconnecting forever with an expired token.
 */
export async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = onRefresh();
  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
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
    if (
      res.status === 403 &&
      (errorBody as { message?: string }).message === 'password_change_required'
    ) {
      // La sesión vive, pero la contraseña temporal no se cambió todavía: la app
      // lleva a la pantalla de cambio en vez de mostrar un error suelto.
      window.dispatchEvent(new CustomEvent('password-change-required'));
    }
    throw new ApiError(errorBody.message || `HTTP ${res.status}`, res.status, errorBody);
  }

  if (res.status === 204) {
    return { data: undefined as T, status: res.status };
  }

  const totalHeader = res.headers.get('X-Total-Count');
  const data = await res.json();
  return {
    data,
    status: res.status,
    ...(totalHeader ? { total: Number(totalHeader) } : {}),
  };
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
    throw new ApiError(errorBody.message || `HTTP ${res.status}`, res.status, errorBody);
  }

  if (res.status === 204) {
    return { data: undefined as T, status: res.status };
  }

  const totalHeader = res.headers.get('X-Total-Count');
  const data = await res.json();
  return {
    data,
    status: res.status,
    ...(totalHeader ? { total: Number(totalHeader) } : {}),
  };
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

/** Reads the file name the server proposed in `Content-Disposition`. */
function filenameFromDisposition(header: string | null): string | null {
  if (!header) return null;
  const encoded = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (encoded?.[1]) {
    try {
      return decodeURIComponent(encoded[1].trim());
    } catch {
      return encoded[1].trim();
    }
  }
  const plain = /filename="?([^";]+)"?/i.exec(header);
  return plain?.[1]?.trim() ?? null;
}

/**
 * Downloads a file from the API. A plain `<a href>` cannot authenticate
 * because the token travels in a header, so the file is fetched as a blob and
 * handed to the browser with the name the server chose.
 */
export async function downloadFile(path: string): Promise<{ blob: Blob; filename: string }> {
  const requestFile = (token: string | null) =>
    fetch(`${CONFIG.API_URL}${path}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

  let res = await requestFile(getToken());
  if (res.status === 401) {
    const newToken = await refreshAccessToken();
    if (!newToken) {
      onLogout();
      throw new Error('Session expired');
    }
    res = await requestFile(newToken);
  }

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new ApiError(errorBody.message || `HTTP ${res.status}`, res.status, errorBody);
  }

  return {
    blob: await res.blob(),
    filename: filenameFromDisposition(res.headers.get('Content-Disposition')) ?? 'reporte',
  };
}

export async function upload<T>(path: string, formData: FormData): Promise<ApiResponse<T>> {
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
    throw new ApiError(errorBody.message || `HTTP ${res.status}`, res.status, errorBody);
  }

  const data = await res.json();
  return { data, status: res.status };
}
