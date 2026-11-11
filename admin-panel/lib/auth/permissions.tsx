"use client";

import { createContext, ReactNode, useContext } from "react";

type Access = { permissions: string[]; isSuperuser: boolean };

const PermissionsContext = createContext<Access>({ permissions: [], isSuperuser: false });

/** Resolved RBAC codes and ``is_superuser`` from Django (the same values the JWT carries).
 * UI hiding is a convenience only; Django re-checks every request. */
export function PermissionsProvider({
  permissions,
  isSuperuser,
  children,
}: Access & { children: ReactNode }) {
  return <PermissionsContext.Provider value={{ permissions, isSuperuser }}>{children}</PermissionsContext.Provider>;
}

/** Superusers hold every code, including ones added after their session started. */
export function useCan(): (permission: string) => boolean {
  const { permissions, isSuperuser } = useContext(PermissionsContext);
  return (permission) => isSuperuser || permissions.includes(permission);
}
