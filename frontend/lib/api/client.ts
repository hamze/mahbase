/**
 * Central browser API client. All backend calls go through the same-origin proxy (/api/backend),
 * which attaches the JWT from the HttpOnly cookie; the browser never sees tokens.
 */
export class ApiError extends Error {
  constructor(
    public status: number,
    public data: unknown,
  ) {
    super(`API request failed with status ${status}`);
  }
}

type RequestOptions = { method?: string; json?: unknown; formData?: FormData; query?: Record<string, string | undefined> };

async function send(path: string, options: RequestOptions): Promise<Response> {
  const query = new URLSearchParams(
    Object.entries(options.query ?? {}).filter((entry): entry is [string, string] => Boolean(entry[1])),
  ).toString();
  const init: RequestInit = { method: options.method ?? "GET", credentials: "same-origin" };
  if (options.formData) {
    init.body = options.formData;
  } else if (options.json !== undefined) {
    init.body = JSON.stringify(options.json);
    init.headers = { "Content-Type": "application/json" };
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
  const data = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) throw new ApiError(response.status, data);
  return data as T;
}

export type Page<T> = { count: number; next: string | null; previous: string | null; results: T[] };
