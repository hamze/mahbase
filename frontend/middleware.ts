import { NextRequest, NextResponse } from "next/server";

import { refreshTokens } from "@/lib/server/backend";
import {
  ACCESS_COOKIE,
  ACCESS_COOKIE_MAX_AGE,
  cookieOptions,
  REFRESH_COOKIE,
  REFRESH_COOKIE_MAX_AGE,
} from "@/lib/server/config";

/**
 * Server-side session boundary: when the short-lived access cookie has expired, rotate the refresh token
 * with Django before the page or API proxy runs. Tokens never reach browser JavaScript.
 */
export async function middleware(request: NextRequest) {
  const isApi = request.nextUrl.pathname.startsWith("/api/");
  if (request.nextUrl.pathname === "/manage/login" || request.cookies.has(ACCESS_COOKIE)) {
    return NextResponse.next();
  }

  const refresh = request.cookies.get(REFRESH_COOKIE)?.value;
  const tokens = refresh ? await refreshTokens(refresh) : null;
  if (tokens) {
    request.cookies.set(ACCESS_COOKIE, tokens.access);
    request.cookies.set(REFRESH_COOKIE, tokens.refresh);
    const response = NextResponse.next({ request: { headers: request.headers } });
    response.cookies.set(ACCESS_COOKIE, tokens.access, { ...cookieOptions, maxAge: ACCESS_COOKIE_MAX_AGE });
    response.cookies.set(REFRESH_COOKIE, tokens.refresh, { ...cookieOptions, maxAge: REFRESH_COOKIE_MAX_AGE });
    return response;
  }

  // A parallel request may have rotated the refresh token already; API callers retry once with the new cookies.
  if (isApi) return NextResponse.json({ detail: "not_authenticated" }, { status: 401 });
  return NextResponse.redirect(new URL("/manage/login", request.url));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|media/|favicon.ico).*)"],
};
