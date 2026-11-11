import { cookies } from "next/headers";

import { backendFetch, unwrap } from "@/lib/server/backend";
import { ACCESS_COOKIE } from "@/lib/server/config";

export type CurrentUser = {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  is_staff: boolean;
  is_superuser: boolean;
  customer_tier: "RETAIL" | "WHOLESALE" | null;
  permissions: string[];
};

/** Fetch JSON from Django in a server component using the access cookie the middleware keeps fresh. */
export async function serverGet<T>(path: string): Promise<T | null> {
  const access = (await cookies()).get(ACCESS_COOKIE)?.value;
  return unwrap<T>(await backendFetch(path, {}, access));
}

export function getCurrentUser(): Promise<CurrentUser | null> {
  return serverGet<CurrentUser>("auth/me/");
}
