/**
 * Central browser API client. All backend calls go through the same-origin proxy (/api/backend),
 * which attaches the JWT from the HttpOnly cookie; the browser never sees tokens.
 *
 * Every backend body is ``{state, message, data}``: requests resolve to ``data``; an ``ApiError`` keeps the error
 * ``state`` (code), the Persian ``serverMessage`` and the details in ``data``.
 */
type Envelope = { state?: string; message?: string; data?: unknown } | null;

export class ApiError extends Error {
  public state: string | null;
  public serverMessage: string | null;
  public data: unknown;

  constructor(
    public status: number,
    body: Envelope,
  ) {
    super(`API request failed with status ${status}`);
    this.state = body?.state ?? null;
    this.serverMessage = body?.message ?? null;
    this.data = body?.data ?? null;
  }
}

type RequestOptions = {
  method?: string;
  json?: unknown;
  formData?: FormData;
  query?: Record<string, string | undefined>;
  headers?: Record<string, string>;
};

async function send(path: string, options: RequestOptions): Promise<Response> {
  const query = new URLSearchParams(
    Object.entries(options.query ?? {}).filter((entry): entry is [string, string] => Boolean(entry[1])),
  ).toString();
  const headers: Record<string, string> = { ...options.headers };
  const init: RequestInit = { method: options.method ?? "GET", credentials: "same-origin", headers };
  if (options.formData) {
    init.body = options.formData;
  } else if (options.json !== undefined) {
    init.body = JSON.stringify(options.json);
    headers["Content-Type"] = "application/json";
  }
  return fetch(`/api/backend/${path.replace(/^\/|\/$/g, "")}${query ? `?${query}` : ""}`, init);
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  let response = await send(path, options);
  if (response.status === 401) {
    // Another request may have just rotated the session cookies; retry once before giving up.
    response = await send(path, options);
    if (response.status === 401) {
      window.location.assign("/manage/login");
    }
  }
  const body: Envelope = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) throw new ApiError(response.status, body);
  return (body?.data ?? null) as T;
}

export type Page<T> = { count: number; next: string | null; previous: string | null; results: T[] };
