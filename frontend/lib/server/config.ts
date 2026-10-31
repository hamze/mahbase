export const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8000";

export const ACCESS_COOKIE = "mb_access";
export const REFRESH_COOKIE = "mb_refresh";

// The access cookie expires slightly before the JWT so the middleware refreshes before Django rejects it.
export const ACCESS_COOKIE_MAX_AGE = Number(process.env.JWT_ACCESS_COOKIE_SECONDS ?? 240);
export const REFRESH_COOKIE_MAX_AGE = Number(process.env.JWT_REFRESH_COOKIE_SECONDS ?? 86400);

export const cookieOptions = {
  httpOnly: true,
  secure: process.env.COOKIE_SECURE !== "false",
  sameSite: "strict" as const,
  path: "/",
};
