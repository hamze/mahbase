/**
 * The one HTTP client for the backend API.
 *
 * In the browser requests stay same-origin (``/api/…``, forwarded to Django by ``app/api/[...path]/route.js``); during
 * server rendering they go straight to ``BACKEND_URL`` as an anonymous visitor (public pages only). Owns the JSON
 * request setup, the Bearer access token (kept in memory), the refresh token (localStorage, so the customer stays
 * signed in), one shared refresh on 401, and the error shape. Feature modules in src/api/ build on ``api``; pages
 * never call fetch directly.
 */

const REFRESH_KEY = 'auth.refresh';

let accessToken = null;
let refreshing = null;
const listeners = new Set();

/**
 * Every API body is ``{state, message, data}`` (backend ``config.api.responses.Responses``). An error keeps
 * ``state`` (its code), ``data`` (details such as ``{field: [messages]}`` or per-line objects) and ``messages``:
 * the details flattened for display, or else the Persian ``message``.
 */
export class ApiError extends Error {
  constructor(status, body) {
    const data = body?.data ?? null;
    const flattened = flattenErrors(data);
    const messages = flattened.length ? flattened : body?.message ? [body.message] : [];
    super(messages[0] || `HTTP ${status}`);
    this.status = status;
    this.state = body?.state ?? null;
    this.data = data;
    this.messages = messages;
  }
}

function flattenErrors(data) {
  if (data == null) return [];
  if (typeof data === 'string') return [data];
  if (Array.isArray(data)) return data.flatMap(flattenErrors);
  if (typeof data === 'object') return Object.values(data).flatMap(flattenErrors);
  return [String(data)];
}

export function getRefreshToken() {
  try {
    return localStorage.getItem(REFRESH_KEY);
  } catch {
    return null;
  }
}

/** Store tokens after login/refresh; ``null`` signs out. Listeners (AuthContext) are told when the session ends. */
export function setTokens(tokens) {
  accessToken = tokens?.access ?? null;
  try {
    if (tokens?.refresh) localStorage.setItem(REFRESH_KEY, tokens.refresh);
    else if (!tokens) localStorage.removeItem(REFRESH_KEY);
  } catch {
    /* storage unavailable: the session lasts until the tab closes */
  }
  if (!tokens) listeners.forEach((listener) => listener());
}

export function onSessionEnded(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Exchange the stored refresh token (rotated by the backend) for a new pair; one request at a time. */
export function refreshSession() {
  const refresh = getRefreshToken();
  if (!refresh) return Promise.resolve(false);
  refreshing ??= fetch('/api/auth/token/refresh/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh }),
  })
    .then(async (response) => {
      if (!response.ok) {
        setTokens(null);
        return false;
      }
      setTokens((await response.json()).data);
      return true;
    })
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

const isServer = typeof window === 'undefined';

const apiBase = () =>
  isServer ? `${process.env.BACKEND_URL || 'http://localhost:8000'}/api` : `${window.location.origin}/api`;

async function request(method, path, { body, query, headers = {}, auth = true } = {}) {
  const url = new URL(`${apiBase()}${path}`);
  Object.entries(query || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, value);
  });
  const send = () =>
    fetch(url, {
      method,
      credentials: 'same-origin',
      cache: isServer ? 'no-store' : undefined,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(auth && accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

  let response = await send();
  if (response.status === 401 && auth && getRefreshToken() && (await refreshSession())) {
    response = await send();
  }
  if (response.status === 204) return null;
  const payload = response.headers.get('content-type')?.includes('application/json') ? await response.json() : null;
  if (!response.ok) throw new ApiError(response.status, payload);
  return payload?.data ?? null;
}

export const api = {
  get: (path, query, options) => request('GET', path, { ...options, query }),
  post: (path, body, options) => request('POST', path, { ...options, body }),
  patch: (path, body, options) => request('PATCH', path, { ...options, body }),
  put: (path, body, options) => request('PUT', path, { ...options, body }),
  delete: (path, options) => request('DELETE', path, options),
};
