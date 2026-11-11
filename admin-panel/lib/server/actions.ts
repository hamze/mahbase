"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { obtainTokens, revokeRefreshToken } from "@/lib/server/backend";
import {
  ACCESS_COOKIE,
  ACCESS_COOKIE_MAX_AGE,
  cookieOptions,
  REFRESH_COOKIE,
  REFRESH_COOKIE_MAX_AGE,
} from "@/lib/server/config";

export type LoginState = { error: boolean };

export async function login(_: LoginState, formData: FormData): Promise<LoginState> {
  const tokens = await obtainTokens(String(formData.get("username")), String(formData.get("password")));
  if (!tokens) return { error: true };
  const store = await cookies();
  store.set(ACCESS_COOKIE, tokens.access, { ...cookieOptions, maxAge: ACCESS_COOKIE_MAX_AGE });
  store.set(REFRESH_COOKIE, tokens.refresh, { ...cookieOptions, maxAge: REFRESH_COOKIE_MAX_AGE });
  redirect("/manage");
}

export async function logout(): Promise<void> {
  const store = await cookies();
  const refresh = store.get(REFRESH_COOKIE)?.value;
  if (refresh) await revokeRefreshToken(refresh);
  store.delete(ACCESS_COOKIE);
  store.delete(REFRESH_COOKIE);
  redirect("/manage/login");
}
