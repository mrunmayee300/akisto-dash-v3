const configuredBaseUrl = import.meta.env.VITE_API_URL || import.meta.env.VITE_APPS_SCRIPT_URL || '';
const API_BASE_URL = configuredBaseUrl.replace(/\/+$/, '');

const AUTH_KEYS = ['sessionToken', 'userEmail', 'companyName', 'userName', 'userRole'];

export class ApiError extends Error {
  constructor(message, status, payload) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.payload = payload;
  }
}

export function clearAuthSession() {
  AUTH_KEYS.forEach(key => localStorage.removeItem(key));
}

export function getSessionToken() {
  return localStorage.getItem('sessionToken');
}

export function hasSession() {
  return Boolean(getSessionToken());
}

export function isUnauthorized(error) {
  return error instanceof ApiError && error.status === 401;
}

export async function apiRequest(path, { auth = true, headers, body, ...options } = {}) {
  if (!API_BASE_URL) {
    throw new ApiError('VITE_API_URL is not configured', 0, null);
  }

  const requestHeaders = new Headers(headers || {});
  if (body !== undefined && !requestHeaders.has('Content-Type')) {
    requestHeaders.set('Content-Type', 'application/json');
  }

  if (auth) {
    const token = getSessionToken();
    if (!token) throw new ApiError('Authentication required', 401, null);
    requestHeaders.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: requestHeaders,
    body: body === undefined || typeof body === 'string' ? body : JSON.stringify(body),
  });

  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json')
    ? await response.json()
    : null;

  if (!response.ok || payload?.success === false) {
    throw new ApiError(payload?.message || `Request failed (${response.status})`, response.status, payload);
  }

  return payload;
}
