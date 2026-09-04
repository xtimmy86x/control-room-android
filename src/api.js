import { CapacitorHttp } from '@capacitor/core';

export class ApiError extends Error {
  constructor(message, status = 0) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export function normalizeBaseUrl(value) {
  const raw = String(value || '').trim().replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(raw)) {
    throw new ApiError(
      'Inserisci un URL completo, ad esempio https://control.example.com',
    );
  }
  return raw;
}

export async function request({
  baseUrl,
  token = null,
  path,
  method = 'GET',
  data = undefined,
  timeout = 15000,
}) {
  const headers = { Accept: 'application/json' };

  if (data !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await CapacitorHttp.request({
    url: `${normalizeBaseUrl(baseUrl)}${path}`,
    method,
    headers,
    data,
    connectTimeout: timeout,
    readTimeout: timeout,
  });

  if (response.status < 200 || response.status >= 300) {
    const detail =
      response.data && typeof response.data === 'object'
        ? response.data.detail
        : null;
    throw new ApiError(detail || `HTTP ${response.status}`, response.status);
  }

  return response.data;
}

export function websocketUrl(baseUrl, ticket) {
  const url = new URL(normalizeBaseUrl(baseUrl));
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.pathname = `${url.pathname.replace(/\/+$/, '')}/ws`;
  url.search = `ticket=${encodeURIComponent(ticket)}`;
  return url.toString();
}
