"use client";

import { createContext, ReactNode, useContext } from "react";

const PermissionsContext = createContext<string[]>([]);

/** Permission names from Django's /auth/me/. UI hiding is a convenience only; Django enforces RBAC. */
export function PermissionsProvider({ permissions, children }: { permissions: string[]; children: ReactNode }) {
  return <PermissionsContext.Provider value={permissions}>{children}</PermissionsContext.Provider>;
}

export function useCan(): (permission: string) => boolean {
  const permissions = useContext(PermissionsContext);
  return (permission) => permissions.includes(permission);
}
