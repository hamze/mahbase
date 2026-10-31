import { BACKEND_URL } from "@/lib/server/config";

export type TokenPair = { access: string; refresh: string };

/** The only place that talks to Django over HTTP (login, refresh, logout, proxy and server components). */
export async function backendFetch(path: string, init: RequestInit = {}, accessToken?: string): Promise<Response> {
  const headers = new Headers(init.headers);
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  return fetch(`${BACKEND_URL}/api/${path}`, { ...init, headers, cache: "no-store" });
}

function postJson(path: string, body: unknown): Promise<Response> {
  return backendFetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function obtainTokens(username: string, password: string): Promise<TokenPair | null> {
  const response = await postJson("auth/token/", { username, password });
  return response.ok ? response.json() : null;
}

export async function refreshTokens(refresh: string): Promise<TokenPair | null> {
  const response = await postJson("auth/token/refresh/", { refresh });
  return response.ok ? response.json() : null;
}

export async function revokeRefreshToken(refresh: string): Promise<void> {
  await postJson("auth/logout/", { refresh });
}
